# DPP 全量代码审查报告

- 审查日期：2026-08-29
- 审查范围：浏览器扩展全部 TypeScript/React 源码、同步与加密链路、Recorder/PageAgent、background 消息、Jenkins、配置导入导出、Cloudflare Worker、构建配置及生产依赖
- 审查方式：模块化静态审查、跨文件调用链核对、TypeScript/ESLint/测试/双浏览器构建验证、生产依赖漏洞扫描
- 工作区基线：`main` 分支，提交 `d1b2c51`

## 1. 结论摘要

本次审查共确认：

| 严重级别        | 数量 | 说明                                                                 |
| --------------- | ---: | -------------------------------------------------------------------- |
| 高风险          |    8 | 可能造成凭据泄露、敏感数据泄露、数据丢失、同步数据复活或跨会话污染   |
| 中风险          |   16 | 可能造成权限边界扩大、状态竞态、数据不一致、资源耗尽或迁移完整性问题 |
| 低风险/覆盖缺口 |    5 | 生命周期竞态、交互错误、健康检查和测试覆盖不足                       |

当前没有发现普通网页可直接利用的 DOM XSS。高风险主要集中在以下方面：

1. Jenkins 凭据可能被发送到非预期主机。
2. Recorder 无脱敏、无总量限制地持久化网络和控制台数据。
3. 个人同步全量补队列遗漏删除墓碑。
4. “全部设置”导入实际会清空整个本地数据库。
5. AI 会话切换存在跨会话异步覆盖。
6. 当前生产依赖审计存在大量已知漏洞。

## 2. 高风险问题

### H-01 Jenkins 凭据可被发送到任意 `jobUrl`

**位置**

- [`src/entrypoints/background/handlers/jenkins.ts:29`](../src/entrypoints/background/handlers/jenkins.ts#L29)
- [`src/features/jenkins/api/build.ts:12`](../src/features/jenkins/api/build.ts#L12)
- [`src/features/jenkins/api/build.ts:43`](../src/features/jenkins/api/build.ts#L43)
- [`src/features/jenkins/api/build.ts:73`](../src/features/jenkins/api/build.ts#L73)
- [`src/features/jenkins/api/build.ts:109`](../src/features/jenkins/api/build.ts#L109)

**触发场景**

`JENKINS_TRIGGER_BUILD`、`JENKINS_GET_JOB_DETAILS` 或 `JENKINS_CANCEL_BUILD` 消息携带攻击者控制的 `jobUrl`，同时通过 `envId` 选择已保存有效凭据的 Jenkins 环境。

**影响**

代码会把该环境的 `Authorization: Basic ...` 请求头发送到 `jobUrl` 指向的主机，导致 Jenkins 用户名和 API Token 泄露。默认重定向策略还可能在后续跳转中扩大风险。

**修复方向**

1. 在 background 层解析目标环境的规范化 origin。
2. 要求 `jobUrl` 的协议、hostname 和有效端口与环境 origin 完全一致。
3. 拒绝 URL userinfo、非 HTTP(S) URL 和跨 origin 重定向。
4. 所有 Jenkins 读写入口复用同一 URL 校验函数。

### H-02 Jenkins 递归遍历会向跨域 folder URL 转发凭据

**位置**

- [`src/features/jenkins/api/fetchJobs.ts:96`](../src/features/jenkins/api/fetchJobs.ts#L96)
- [`src/features/jenkins/api/fetchJobs.ts:101`](../src/features/jenkins/api/fetchJobs.ts#L101)
- [`src/features/jenkins/api/fetchMyBuildsTraversal.ts:41`](../src/features/jenkins/api/fetchMyBuildsTraversal.ts#L41)
- [`src/features/jenkins/api/client.ts:30`](../src/features/jenkins/api/client.ts#L30)

**触发场景**

恶意、被攻陷或配置错误的 Jenkins 在 `jobs[].url` 中返回其他域名或内网地址，并把对应 job 声明为 folder。

**影响**

递归遍历器会携带原 Jenkins 的 Basic Auth 请求返回的 URL，造成凭据泄露和非预期内网请求。该路径不要求消息调用方直接控制 `jobUrl`。

**修复方向**

在保存和递归访问服务端返回 URL 前，强制校验其 origin 与 `client.rootUrl` 一致；同时限制遍历节点总数、URL 数量和重定向。

### H-03 Recorder 原样持久化并导出敏感网络数据

**位置**

- [`src/entrypoints/network-interceptor/utils.ts:3`](../src/entrypoints/network-interceptor/utils.ts#L3)
- [`src/entrypoints/network-interceptor/utils.ts:50`](../src/entrypoints/network-interceptor/utils.ts#L50)
- [`src/entrypoints/network-interceptor/fetchShared.ts:62`](../src/entrypoints/network-interceptor/fetchShared.ts#L62)
- [`src/entrypoints/network-interceptor/xhr.ts:43`](../src/entrypoints/network-interceptor/xhr.ts#L43)
- [`src/entrypoints/background/handlers/recorderMessages.ts:93`](../src/entrypoints/background/handlers/recorderMessages.ts#L93)
- [`src/lib/db/recorderTransfer.ts:67`](../src/lib/db/recorderTransfer.ts#L67)
- [`src/entrypoints/zentao/recordingPicker.ts:106`](../src/entrypoints/zentao/recordingPicker.ts#L106)

**触发场景**

用户录制包含 `Authorization`、API Key、Token、Cookie、敏感表单、登录响应、SSE 或 LLM 输出的页面。

**影响**

请求头、请求体和文本响应体会长期保存在 IndexedDB 中，并可导出为 JSON 或通过 ZenTao 附件链路上传。录像文件分享后，凭据和业务数据会一并泄露。

`rrweb` 已设置 `maskAllInputs: true`，但该设置不覆盖自定义网络和 console 插件采集的数据。

**修复方向**

1. 在主世界数据进入事件桥前遮蔽 `Authorization`、`Cookie`、`Set-Cookie` 和 API Key 类字段。
2. 递归脱敏 JSON、FormData、URL query 和文本响应。
3. 导出及上传前执行第二次防御性脱敏。
4. 对用户明确提示录像可能包含敏感数据。

### H-04 Recorder 网络和 console 采集没有总量上限

**位置**

- [`src/entrypoints/network-interceptor/streamResponse.ts:9`](../src/entrypoints/network-interceptor/streamResponse.ts#L9)
- [`src/entrypoints/network-interceptor/streamResponse.ts:32`](../src/entrypoints/network-interceptor/streamResponse.ts#L32)
- [`src/entrypoints/network-interceptor/streamShared.ts:23`](../src/entrypoints/network-interceptor/streamShared.ts#L23)
- [`src/entrypoints/console-interceptor/clone.ts:78`](../src/entrypoints/console-interceptor/clone.ts#L78)
- [`src/entrypoints/console-interceptor/cloneSpecial.ts:92`](../src/entrypoints/console-interceptor/cloneSpecial.ts#L92)
- [`src/entrypoints/recorder/controller.ts:28`](../src/entrypoints/recorder/controller.ts#L28)

**触发场景**

页面下载大文本/JSON，使用长时间 SSE、NDJSON、AI 流式输出，或频繁打印大型数组、Map、Set、ArrayBuffer 和嵌套对象。

**影响**

- 普通文本响应被完整读取。
- 流式响应的 `body` 无限增长。
- 每次流更新都复制完整 body 和 chunk 数组。
- console 深克隆没有深度、节点数或字节数限制。
- Recorder 将全部中间事件保存在内存，停止时再次整体序列化。

这可能导致页面卡死、扩展内存或 IndexedDB 配额耗尽，并使整段录像无法保存。

**修复方向**

建立单请求、单事件、单录像和总存储字节预算；超限后记录截断标记和累计字节数。流式事件应保存增量或固定窗口，console 克隆应限制深度、节点数和二进制长度。

### H-05 个人同步全量补队列不会生成删除操作

**位置**

- [`src/lib/sync/enqueuePersonalData.ts:42`](../src/lib/sync/enqueuePersonalData.ts#L42)
- [`src/lib/sync/enqueuePersonalData.ts:67`](../src/lib/sync/enqueuePersonalData.ts#L67)
- [`src/lib/db/totpMutations.ts:154`](../src/lib/db/totpMutations.ts#L154)

**问题**

代码先把所有 `deletedAt` 记录过滤为 `activeItems`，随后却在遍历 `activeItems` 时使用：

```ts
type: isSoftDeleted(item) ? 'delete' : 'create';
```

删除分支永远不可达。

**影响**

个人私钥首次配置、更换密钥、bootstrap 重置或本地数据重建后，删除墓碑不会重新上传。其他设备可能保留已删除 TOTP；清库后旧远端 create 操作还可能让账户重新出现。

**修复方向**

补队列时同时纳入活动实体和墓碑；墓碑生成 delete operation，时间戳使用实体 `updatedAt` 或 `deletedAt`。同时增加个人删除在换钥、清库重建和多设备同步场景的测试。

### H-06 “全部设置”导入会清空整个本地数据库

**位置**

- [`src/entrypoints/options/useOptionsExport.ts:83`](../src/entrypoints/options/useOptionsExport.ts#L83)
- [`src/entrypoints/options/useOptionsImportAndReset.ts:128`](../src/entrypoints/options/useOptionsImportAndReset.ts#L128)
- [`src/entrypoints/options/useOptionsImportAndReset.ts:209`](../src/entrypoints/options/useOptionsImportAndReset.ts#L209)
- [`src/entrypoints/options/useOptionsImportAndReset.ts:290`](../src/entrypoints/options/useOptionsImportAndReset.ts#L290)

**触发场景**

导入正常的配置备份，并保持默认的全部分类选中状态。

**影响**

导出文件只包含 settings 和可选 AI profiles，但 `replaceAll` 会执行所有 Dexie 表的 `clear()`，包括链接、标签、黑板、TOTP、录制、同步 operations 和 metadata。未同步业务数据会永久丢失。

确认文案虽然提到清空业务数据，但“全部设置”与实际全库清理的语义仍明显不匹配，并且该流程没有通过 SyncEngine 的统一互斥和 runtime reset 链路。

**修复方向**

配置导入只覆盖被选择的设置和 profile。清空业务数据只能放在独立、默认关闭、明确命名的重建流程中，并通过 SyncEngine 互斥执行。

### H-07 AI 会话切换存在跨会话异步覆盖

**位置**

- [`src/features/aiAssistant/hooks/useAIChatSessions.ts:38`](../src/features/aiAssistant/hooks/useAIChatSessions.ts#L38)
- [`src/features/aiAssistant/hooks/useAIChatSessions.ts:59`](../src/features/aiAssistant/hooks/useAIChatSessions.ts#L59)

**触发场景**

用户快速从会话 A 切换到 B，A 的 `getMessagesBySession` 比 B 更晚返回。

**影响**

A 的延迟结果仍会调用 `onMessagesLoaded(A, ...)` 并执行 `setSessionId(A)`，覆盖当前 B 会话。用户后续发送消息时可能写入错误会话，形成跨会话数据污染。

**修复方向**

为加载请求维护递增 token 或 AbortController；提交结果前校验请求仍为最新目标会话。

### H-08 生产依赖审计存在大量已知漏洞

**位置**

- [`package.json:30`](../package.json#L30)
- [`package.json:47`](../package.json#L47)
- [`package.json:58`](../package.json#L58)
- [`package.json:61`](../package.json#L61)
- [`package.json:95`](../package.json#L95)
- `pnpm-lock.yaml`

使用官方 registry 执行：

```bash
corepack pnpm audit --prod --registry=https://registry.npmjs.org
```

结果：

- 63 个漏洞
- 20 个 high
- 34 个 moderate
- 9 个 low

主要涉及：

- 直接依赖 `lodash-es`：代码注入、原型污染。
- Monaco 链路中的 DOMPurify：多项 XSS 绕过。
- `react-diff-viewer-continued` 链路中的 `js-yaml`：CPU DoS。
- Vite/Rollup/PostCSS/UnoCSS 构建链路：任意文件读写、路径穿越等。
- Worker 依赖链中的 glob/minimatch/brace-expansion：命令注入或 ReDoS/DoS。

部分漏洞只影响构建或开发环境，但当前审计结果不满足发布门槛。应升级可直接升级的依赖，并对无法升级的传递依赖记录是否可达和临时缓解措施。

## 3. 中风险问题

### M-01 页面可伪造或停止 Recorder interceptor 事件

**位置**

- [`src/entrypoints/recorder/interceptors.ts:41`](../src/entrypoints/recorder/interceptors.ts#L41)
- [`src/entrypoints/recorder/interceptors.ts:61`](../src/entrypoints/recorder/interceptors.ts#L61)
- [`src/entrypoints/network-interceptor/install.ts:17`](../src/entrypoints/network-interceptor/install.ts#L17)
- [`src/entrypoints/console-interceptor/install.ts:52`](../src/entrypoints/console-interceptor/install.ts#L52)

公开的 `dpp-network-request`、`dpp-console-log`、`dpp-network-restore` 和 `dpp-console-restore` CustomEvent 没有录制会话 token、来源标识、schema 或大小限制。网页脚本可污染录像、注入大载荷或提前解除拦截。

应为每次录制生成随机 channel/token，并对 event detail 做严格 schema 和大小校验；restore 事件也必须认证。

### M-02 XHR 可能产生冲突终态并遗留监听器

**位置**

- [`src/entrypoints/network-interceptor/xhrListeners.ts:36`](../src/entrypoints/network-interceptor/xhrListeners.ts#L36)
- [`src/entrypoints/network-interceptor/xhrListeners.ts:63`](../src/entrypoints/network-interceptor/xhrListeners.ts#L63)
- [`src/entrypoints/network-interceptor/xhrListeners.ts:95`](../src/entrypoints/network-interceptor/xhrListeners.ts#L95)
- [`src/entrypoints/network-interceptor/xhrListeners.ts:123`](../src/entrypoints/network-interceptor/xhrListeners.ts#L123)

error 或 timeout 事件后，loadend 仍可能记录 complete；`readystatechange` 和 `_dppNetworkData` 不会在终态统一清理。应建立单一 terminal 标志，并在任一终态移除全部监听器和请求状态。

### M-03 软删除的标签关联无法通过 toggle 重新添加

**位置**

- [`src/lib/db/tagsAssociations.ts:21`](../src/lib/db/tagsAssociations.ts#L21)
- [`src/lib/db/tagsAssociations.ts:38`](../src/lib/db/tagsAssociations.ts#L38)
- [`src/db/schema.ts:56`](../src/db/schema.ts#L56)

`linkTags` 和 `jobTags` 使用复合主键。移除关联后记录仍以墓碑形式存在，但 toggle 查询只接受未删除关联，随后调用 `add()` 会因复合主键已存在而失败。

重新添加时应查找包括墓碑在内的记录，并通过 `put/update` 清除 `deletedAt`；整个 toggle 应放在事务中。

### M-04 黑板编辑内容会被外部更新覆盖

**位置**

- [`src/features/blackboard/components/useBlackboardItemEditor.ts:62`](../src/features/blackboard/components/useBlackboardItemEditor.ts#L62)
- [`src/features/blackboard/components/useBlackboardItemEditor.ts:101`](../src/features/blackboard/components/useBlackboardItemEditor.ts#L101)

编辑期间，同步或其他组件更新 `item.content` 会无条件执行 `setContent(item.content)`，覆盖用户尚未提交的输入。应在编辑期间保留本地草稿，并使用编辑基线或版本号检测冲突。

### M-05 TOTP 批量导入不是原子操作

**位置**

- [`src/features/totp/components/TotpView.tsx:136`](../src/features/totp/components/TotpView.tsx#L136)

账户逐条写入；中途因加密、同步 hook、配额或 IndexedDB 故障失败时，前面的账户已经提交。重试可能产生重复账户。应在 DB 层使用单一 Dexie 事务实现批量导入，或明确返回成功/失败明细。

### M-06 同步设置保存不是原子操作

**位置**

- [`src/entrypoints/options/useOptionsSettings.ts:30`](../src/entrypoints/options/useOptionsSettings.ts#L30)
- [`src/entrypoints/options/useOptionsSettings.ts:51`](../src/entrypoints/options/useOptionsSettings.ts#L51)

初始化读取没有错误处理，并可能在用户开始输入后覆盖表单状态。保存过程对 URL、token、enabled、interval 执行四次独立写入，任一步失败都会留下半保存配置。

应增加 loading/dirty 状态、读取异常反馈，并在 Dexie 事务内原子写入相关配置。

### M-07 功能开关写入失败没有反馈

**位置**

- [`src/entrypoints/options/useOptionsSettings.ts:88`](../src/entrypoints/options/useOptionsSettings.ts#L88)

`toggleFeature` 没有 try/catch。数据库写入失败会形成未处理 rejection，用户无法知道开关未生效。应统一记录日志、显示错误 toast，并在操作期间防止重复提交。

### M-08 同步密钥复制失败仍提示成功

**位置**

- [`src/features/settings/components/useSyncKeyManager.ts:123`](../src/features/settings/components/useSyncKeyManager.ts#L123)

`navigator.clipboard.writeText` 没有被 await 或捕获，失败时仍立即显示“密钥已复制”。用户可能在未成功备份密钥的情况下执行清除或迁移。

### M-09 TOTP PIN 验证异常没有转为用户错误

**位置**

- [`src/features/totp/hooks/useTotpPinLock.ts:36`](../src/features/totp/hooks/useTotpPinLock.ts#L36)

`unlock` 只有 finally，没有 catch。WebCrypto、IndexedDB 或数据损坏异常会形成未处理 rejection，同时 `unlockError` 不更新。应记录安全脱敏日志并显示通用解锁错误。

### M-10 Proxy 白名单实际允许所有公共主机

**位置**

- [`src/utils/urlSafety.ts:92`](../src/utils/urlSafety.ts#L92)
- [`src/utils/urlSafety.ts:117`](../src/utils/urlSafety.ts#L117)
- [`src/entrypoints/background/handlers/proxy.ts:117`](../src/entrypoints/background/handlers/proxy.ts#L117)

`assertFetchUrlSafe` 对不在白名单、但字符串形式不是私有地址的任意 hostname 最终返回 `ok: true`。这与“host 必须在白名单内”的注释和调用方安全假设不一致；校验还没有绑定协议和端口。

应根据业务类型匹配完整 origin；如果目标设计确实允许任意公网 URL，应重命名函数并单独实现 DNS/IP、重定向和私网防护。

### M-11 高权限 background handler 缺少按上下文授权

**位置**

- [`src/entrypoints/background.ts:25`](../src/entrypoints/background.ts#L25)
- [`src/entrypoints/background/backgroundMessageRouter.ts:18`](../src/entrypoints/background/backgroundMessageRouter.ts#L18)
- [`src/entrypoints/background/handlers/general.ts:10`](../src/entrypoints/background/handlers/general.ts#L10)
- [`src/entrypoints/background/handlers/recorder.ts:17`](../src/entrypoints/background/handlers/recorder.ts#L17)

Jenkins、截图、录像读取、远程缓存和凭据保存等 handler 没有像 browser task 一样根据 `sender.tab`、扩展页面 URL、frame 和会话做授权。

普通网页因为未配置 `externally_connectable`，不能直接调用 runtime API，因此该问题不是普通网页直接可利用漏洞；但它扩大了受污染 content script 或扩展页面的权限范围。应建立集中式消息 schema 和授权层。

### M-12 远程录像缓存没有容量和所有者限制

**位置**

- [`src/entrypoints/background/handlers/remoteRecording.ts:11`](../src/entrypoints/background/handlers/remoteRecording.ts#L11)
- [`src/entrypoints/zentao/attachments.ts:128`](../src/entrypoints/zentao/attachments.ts#L128)

缓存条目没有数量、总字节、单条载荷和创建者限制；`cacheId` 使用时间戳加 `Math.random()`。大 JSON 可长期占用 service worker 内存。

应使用 `crypto.randomUUID()`、设置 LRU/字节预算、绑定创建 tab 与 player，并在读取后同步删除。

### M-13 Jenkins content script 在所有站点监听 `#dpp-auth`

**位置**

- [`src/entrypoints/jenkins.content.ts:4`](../src/entrypoints/jenkins.content.ts#L4)
- [`src/entrypoints/jenkins/auth.ts:41`](../src/entrypoints/jenkins/auth.ts#L41)
- [`src/entrypoints/jenkins/shared.ts:26`](../src/entrypoints/jenkins/shared.ts#L26)

content script 匹配所有 HTTP(S) 页面，只凭 URL hash 即尝试查询用户、创建 Jenkins Token 并保存当前 origin。应验证目标 origin 属于已配置 Jenkins，并要求扩展生成的一次性 nonce 和明确用户操作。

### M-14 Worker push 缺少请求总预算

**位置**

- [`packages/cf-worker-googlesheet/src/index.ts:60`](../packages/cf-worker-googlesheet/src/index.ts#L60)
- [`packages/cf-worker-googlesheet/src/lib/d1.ts:147`](../packages/cf-worker-googlesheet/src/lib/d1.ts#L147)
- [`packages/cf-worker-googlesheet/src/lib/d1.ts:213`](../packages/cf-worker-googlesheet/src/lib/d1.ts#L213)

最多 50 条 operation 的限制不能阻止单条超大 JSON、深层嵌套对象或超长 id/key/keyHash。代码会执行多次 `JSON.stringify`、递归稳定排序和 fingerprint，认证用户可造成 Worker CPU/内存峰值。

应限制 HTTP body 字节数、字段长度、嵌套深度、数组节点数和批次序列化总预算，超限返回 413。

### M-15 Worker 迁移进度没有服务端连续性校验

**位置**

- [`packages/cf-worker-googlesheet/src/migration.ts:139`](../packages/cf-worker-googlesheet/src/migration.ts#L139)
- [`packages/cf-worker-googlesheet/src/lib/d1.ts:296`](../packages/cf-worker-googlesheet/src/lib/d1.ts#L296)

迁移进度完全由调用方提供的 cursor 决定，服务端不持久化上一次源游标，也不要求页内和跨页连续。误跳页后仍可能继续导入并最终报告完成。

应由服务端维护迁移状态机和 source cursor，拒绝跳跃、倒退或不连续行；结束时校验源/目标 count、min/max cursor 和缺口。

### M-16 Worker 迁移读取会修改源 Sheet，模板与当前 schema 不一致

**位置**

- [`packages/cf-worker-googlesheet/src/lib/sheets.ts:82`](../packages/cf-worker-googlesheet/src/lib/sheets.ts#L82)
- [`packages/cf-worker-googlesheet/src/lib/sheets.ts:93`](../packages/cf-worker-googlesheet/src/lib/sheets.ts#L93)
- [`packages/cf-worker-googlesheet/google-sheets-template.csv:1`](../packages/cf-worker-googlesheet/google-sheets-template.csv#L1)

迁移读取通过 `getOrCreateSheet`，缺少 header 时会调用 `setHeaderRow` 修改源数据。仓库模板仍只有旧字段，缺少 `clientId` 和 `keyHash`。

迁移源应只读；先执行独立 schema 校验，旧格式通过显式版本转换迁移，模板必须与当前协议同步。

## 4. 低风险问题和测试覆盖缺口

### L-01 Omnibox 旧查询结果可覆盖新输入

**位置**

- [`src/entrypoints/background/handlers/omnibox.ts:8`](../src/entrypoints/background/handlers/omnibox.ts#L8)

快速输入时，较早查询可能更晚完成并覆盖当前 suggestion。应使用请求序号或当前输入快照，只提交最新结果。

### L-02 标签输入框 Enter 会触发外层表单提交

**位置**

- [`src/components/ui/tag-selector.tsx:120`](../src/components/ui/tag-selector.tsx#L120)
- [`src/features/links/components/LinkDialog.tsx:55`](../src/features/links/components/LinkDialog.tsx#L55)

创建标签时没有 `preventDefault()`，Enter 会冒泡并提交链接表单，导致意外保存和关闭对话框。

### L-03 链接排序读取和保存失败没有反馈

**位置**

- [`src/features/links/components/LinksView.tsx:30`](../src/features/links/components/LinksView.tsx#L30)

初始化读取和 `updateSetting` 没有错误处理。写入失败时当前页面显示新排序，重新打开后恢复旧值。

### L-04 Worker 健康检查也要求同步 Token

**位置**

- [`packages/cf-worker-googlesheet/src/index.ts:91`](../packages/cf-worker-googlesheet/src/index.ts#L91)
- [`packages/cf-worker-googlesheet/src/migration.ts:170`](../packages/cf-worker-googlesheet/src/migration.ts#L170)

`/health` 和 `/` 在路由前统一鉴权，标准部署探针无法区分服务异常、secret 缺失和普通未授权。可提供不暴露内部状态的匿名健康响应，或使用独立 probe token。

### L-05 Worker 真实运行环境测试不足

**位置**

- [`tests/syncWorker.test.mjs:130`](../tests/syncWorker.test.mjs#L130)
- [`tests/syncWorker.test.mjs:335`](../tests/syncWorker.test.mjs#L335)

当前测试主要使用 Fake D1、纯 helper 和源码正则，没有覆盖：

- 真实 D1 `AUTOINCREMENT`、CHECK、UNIQUE 和 batch 原子性。
- 正常/迁移 Worker HTTP 鉴权和路由。
- Google Sheets 空行、坏行、grid limit、429 和追加后超时。
- 迁移 cursor 跳跃、DO 重启、断点恢复和最终源/目标一致性。

建议使用 Workers 测试池或 Miniflare 加真实 D1 schema，并为 SheetsClient 注入可控 adapter。

## 5. 构建与验证结果

### 5.1 已通过

```text
TypeScript 根项目检查：通过
ESLint 全仓库检查：通过
Node 测试：112/112 通过
Worker 正常入口 TypeScript 检查：通过
Worker 迁移入口 TypeScript 检查：通过
Chrome MV3 生产构建：通过
Firefox MV2 生产构建：通过
```

执行命令：

```bash
corepack pnpm compile
corepack pnpm lint
corepack pnpm test
corepack pnpm --filter dpp-worker exec tsc --noEmit
corepack pnpm --filter dpp-worker check:migration
corepack pnpm clean:build-output
corepack pnpm exec wxt build
corepack pnpm clean:build-output
corepack pnpm exec wxt build -b firefox
```

根 `pnpm build`/`build:firefox` 在本次 Harness 环境中会因其内部再次调用未初始化的 `pnpm` 包装器而失败；绕过该环境包装器后，WXT 构建本身成功，因此没有把这一现象定性为项目构建缺陷。

### 5.2 未通过

```text
生产依赖漏洞扫描：未通过
63 vulnerabilities found
Severity: 9 low | 34 moderate | 20 high
```

最初配置的 `npmmirror` 不支持 pnpm audit endpoint；切换官方 registry 后获得上述有效结果。

### 5.3 构建警告

Chrome 和 Firefox 构建均报告：

```text
@page-agent/page-controller/dist/lib/page-controller.js uses eval
```

当前 `RemotePageController` 没有暴露依赖中的 `executeJavascript` 方法，因此没有把它列为直接可利用漏洞；但该能力仍被打包进 content script，应在升级依赖或调整 tree-shaking 时处理，并防止未来无意暴露。

## 6. 已核对且未发现问题的关键链路

以下高风险链路经过交叉检查，当前实现没有发现独立缺陷：

1. 个人表只使用 personal key，不回落到 team key。
2. 普通 sync apply 事务设置 `tx.source === 'sync'`，Dexie hooks 会跳过来自同步的写入，未发现反馈回路。
3. links、tags、jobTags、linkTags、blackboard 等同步表使用软删除。
4. 链接删除及其 linkTags 更新位于同一事务。
5. 配置导入会保留本机个人私钥、bootstrap 标记和 PIN 相关个人设置。
6. 完全清除本机数据流程会清除 IndexedDB、Web Storage、扩展 storage 和 Cache Storage。
7. browser task background handler 已验证消息来自扩展页面而不是 content script。
8. PageAgent 页面控制由 background 内部通过 `tabs.sendMessage` 发出，当前 background router 没有对网页开放对应转发入口。
9. 播放器展示 network/console 数据时使用 React 文本节点，`innerHTML = ''` 仅用于清空播放器容器，未发现可证实 DOM XSS。
10. 全局同步操作由共享 Web Lock/fallback lock 串行化，因此没有把 UI 快速点击导致的并发请求列为同步数据损坏问题。

## 7. 建议修复顺序

### P0：发布前处理

1. H-01、H-02：Jenkins origin 和重定向约束。
2. H-03、H-04：Recorder 脱敏及字节预算。
3. H-05：个人同步墓碑补队列。
4. H-06：配置导入禁止隐式清库。
5. H-07：AI 会话加载竞态。
6. H-08：升级或处置高危依赖漏洞。

### P1：紧随其后

1. M-01、M-02：Recorder 事件认证和 XHR 状态机。
2. M-03、M-04、M-05：标签、黑板和 TOTP 数据一致性。
3. M-10、M-11、M-12、M-13：扩展权限边界收紧。
4. M-14、M-15、M-16：Worker 输入预算和迁移完整性。

### P2：质量补强

1. 统一异步 UI 操作的错误反馈和原子写入。
2. 修复 Omnibox、标签输入和链接排序问题。
3. 增加真实 D1、HTTP Worker 和 Sheets 迁移测试。
4. 将依赖审计纳入 CI 发布门槛。
