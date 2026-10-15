# 消息通知机制工作流程

DPP 的 Telegram 通知目前只服务一个场景：Jenkins 构建结束提醒（scope 固定为
`jenkins-build`，见 `src/features/notify/canonical.ts`）。核心代码在
`src/features/notify/`（发送与配置）和
`packages/sync-worker/src/lib/notify.ts`（Worker 去重与游标）。

## 触发链（浏览器侧）

1. background service worker 启动时调用 `ensureJenkinsBuildNotifyAlarm()`
   （`src/features/jenkins/buildNotifyScan.ts`），确保每分钟周期的
   `jenkins-build-notify-alarm` 闹钟存在。
2. 闹钟触发后由 `backgroundLifecycle.ts` 的分发进入
   `runJenkinsBuildNotifyScan()`。函数入口的 `scanning` 标志是重入锁，上一轮
   扫描未结束时本轮直接返回。
3. 扫描遍历所有已配置的 Jenkins 环境，按 job 的游标逐个拉取新构建
   （`src/features/jenkins/buildNotifyCore.ts` 的
   `scanJenkinsBuildNotifications`）。只有「终态构建」（result 已定）才进入
   通知流程；构建时间戳低于水位线的直接推进游标跳过。
4. 组装通知文本（模板变量见 `template.ts`，失败时附带日志文件）后调用
   `deliverOnce`；接收对象可按 job 订阅过滤（`subscriptions.ts`，旧对象没有
   订阅配置时默认接收全部 job）。

## deliverOnce 五步（去重发送，`deliverCore.ts`）

1. **装载**：读 bot token、接收对象列表（过滤 `deletedAt`、按 id 排序）和 sync
   clientId。token 或对象为空则本轮不发。
2. **水位线过滤**：对每个对象 `POST /api/notify/since` 读该对象的起始水位
   sinceMs（本地 `sinceCache` 有缓存，测试可用 `clearNotifySinceCache()` 清）。
   `occurredAt < sinceMs` 的构建直接跳过——新加接收对象时水位设为当前时间，
   因此不会收到历史构建。
3. **抢租约**：计算
   `claimKey = sha256(scope + '\n' + chatId + '\n' + dedupKey)`，然后
   `POST /api/notify/claim` { claimKey, clientId }。Worker 在 D1 里做 60 秒
   租约抢占（`CLAIM_UPSERT`）：多个客户端（多台机器都装扩展）同时扫描时，
   只有抢到租约的实例发送；对方已把该 claim 置为 `sent` 的直接跳过。
4. **发送**：抢到租约后调 `sendTelegramNotification`（`telegram.ts`）直发
   Telegram。有日志文件时走 `sendDocument`（说明超 1024 字截断），否则
   `sendMessage`。发送失败按状态码分级：400 走「HTML → 去按钮 → 纯文本」
   三级降级重试；403 视为永久失败（用户没先私信过机器人，或群里没加机器人）；
   401/404 视为 token 失效。
5. **确认**：发送成功后 `POST /api/notify/ack` 把租约置为 `sent`，本轮对该
   对象完成。**发送失败不写 ack**，租约 60 秒过期后其他客户端可接管重发。
   遇到 429/401 或 token 失效时 `deliverOnce` 返回 `halt`，终止本轮扫描，
   等下个闹钟周期再试。

## 配置与试发（设置页）

- **保存**（`saveCore.ts` 的 `saveNotifyConfigWith`）：校验 chat_id 必须是
  纯数字、`@username` 不允许；要求已配置团队同步（`sync_encryption_key` +
  `custom_server_url`）——通知去重依赖 Worker；新增接收对象时先在 Worker 上
  建立水位（`create: true`，水位 = 当前时间）；最后整份配置写入 Dexie
  （`src/lib/db/notify.ts`）。
- **试发**（`sendTest.ts`）：必须与已保存的配置逐字一致（token、模板、对象
  列表全部匹配）才允许发，防止拿未保存的草稿配置发消息。试发**不写水位、不
  占 claim 去重**。
- **订阅过滤**（`subscriptions.ts`）：对象可显式关闭 Jenkins 通知或只订指定
  job 列表（URL 做规范化后比较）；没有任何订阅配置的旧对象保持「接收全部」。

## Worker 侧（dpp-worker）

`packages/sync-worker/src/lib/notify.ts` 的 `handleNotifyRequest`
暴露四个接口，全部用 `X-Access-Token` 鉴权：

| 接口                     | 作用                                                     | D1 表                 |
| ------------------------ | -------------------------------------------------------- | --------------------- |
| `POST /api/notify/since` | 读/建接收对象水位（`create: true` 时建，默认值当前时间） | `notify_target_since` |
| `POST /api/notify/claim` | 按 claimKey 抢 60 秒租约，返回是否 granted               | `notify_claims`       |
| `POST /api/notify/ack`   | 租约持有方把状态置为 `sent`                              | `notify_claims`       |
| `GET/PUT /api/kv`        | 通用 KV（含 increase/decrease 有序更新）                 | `kv_entries`          |

**安全边界**：Worker 请求不携带 bot token、消息正文或 Jenkins 地址
（`workerApi.ts` 注释）。Worker 全程只见 scope、chatId 的哈希 claimKey 和
clientId，凭据和构建内容只存在浏览器本地与 Telegram 之间。

## 调试提示

- 水位缓存：`deliverCore.ts` 的 `sinceCache` 进程内缓存 since 读数，调试时改
  了 Worker 端水位要配合 `clearNotifySinceCache()` 才生效。
- scope 现状：目前只有 `jenkins-build` 一个 scope；新增通知场景时应复用
  `deliverOnce` 并定义自己的 scope 常量，不要改动 `JENKINS_BUILD_SCOPE`。
- 失败不刷 ack：构建通知「发了但 ack 失败」会留下一条 leased 记录，60 秒后
  租约过期，下个周期会重发同一条（claim 未 sent，dedupKey 相同会重新抢到
  租约）。这是设计内的 at-least-once 语义，不是 bug。
