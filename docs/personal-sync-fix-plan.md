# 个人同步修复计划

> 状态：已实施（与当前代码对齐；合入前建议跑一遍第 7 节验证清单）  
> 背景：代码审查覆盖提交 `48e7437`（本地 TOTP + 个人私钥）与未提交的双钥 SyncEngine 接入。  
> 关联设计：[`personal-key-sync-design.md`](./personal-key-sync-design.md)

---

## 1. 目标

在不推翻「个人私钥 + 同服务器 SyncEngine」架构的前提下：

1. **消除本机验证器因配钥/清库被误删**（P0）。
2. **堵住团队钥写入/加密个人表的路径**（P1）。
3. **同步清除与整机清空职责分离**：同步重建可保留个人表；工厂重置仍清全部。
4. 顺带修复混合 batch、软删判定、私钥内存暴露等次要问题。

非目标（本期不做）：本地 secret vault、实体级黑板私人笔记 UI、自动化单测框架搭建。

---

## 2. 问题清单与对策一览

| 级别 | 问题 | 对策 |
|------|------|------|
| P0 | 配钥后 `clearAllData` + `pull` 丢掉本机 totp（pull 跳过本 `clientId`） | 配钥路径禁止破坏性清库；只 enqueue（+ 可选 push） |
| P0 相关 | `clearAllSyncData` 会清掉 `totpAccounts` | 同步清除按 `dataScope` **跳过 personal 表** |
| P1 | Pull 只认 `keyHash`，团队密文可写入个人表 | 解密后校验 scope ↔ 密钥角色，不匹配则 skip |
| P1 | 实体 `dataScope:'team'` 可覆盖表默认 personal | 表级 personal 为下限，禁止降级为 team |
| P2 | 缺团队钥时混合 batch `throw`，堵住个人上传 | 团队缺钥改为 skip（与个人缺钥对称） |
| P2 | `deletedAt` 对 `null` 判定不一致 | 统一 soft-delete helper |
| P3 | 个人私钥常驻 React state | 仅展示/复制时导出 |

---

## 3. 产品行为约定（修复后）

### 3.1 个人私钥写入

| 动作 | 行为 |
|------|------|
| 生成个人私钥 | 保存密钥 → `enqueuePersonalData` → 可选立即 `push` → **不清库、不 pull** |
| 导入个人私钥（本机已有/作为权威） | 同上 |
| 更换/覆盖个人私钥 | 强确认 → 保存新钥 → enqueue → 可选 push → **不清库**；云端旧个人密文作废（文案已有） |
| 启动时 bootstrap（已有钥、未标记） | 仅 enqueue + 打标；不做 clear/pull |

Toast 口径改回接近设计 §6.3：「个人私钥已就绪，验证器将在同步时上传」（若立即 push 成功可补充「已推送 N 条」）。

### 3.2 跨设备恢复

设备 B：导入同一把个人私钥 → **正常 pull**（不必先 clear）。  
本地若几乎为空，pull 即可恢复他机推送的个人密文。  
不在导入路径自动 `clearAllData`。

### 3.3 清除 / 重建

| 入口 | 个人表（`totpAccounts` 等） | 团队同步表 | 个人私钥 |
|------|------------------------------|------------|----------|
| 重建（已配个人私钥） | **清空**后 pull | 清空后 pull | **保留** |
| 重建（未配个人私钥） | **保留**（仅本地，无法从服务器恢复） | 清空后 pull | 无 |
| 清空所有数据 | **清除** | 清除 | **清除** |
| 换团队钥 member `clearAllData()` | **保留**（默认） | 清空后 pull | 保留 |

---

## 4. 实施步骤

### 阶段 A — 数据安全（必须先合）

**A1. 配钥路径去破坏性重建**

- 文件：`src/lib/sync/personalSyncBootstrap.ts`、`src/features/settings/components/usePersonalKeyManager.ts`
- 删除或停用 `finalizePersonalSyncAfterKeyReady` 中的 `clearAllData` + `pull`
- 保留：`bootstrapPersonalSyncAfterKeyReady`（enqueue + `personal_sync_bootstrap_done`）
- 可选：enqueue 后 `engine.push()`；失败只 toast，不回滚已保存的密钥
- 更新 `migrationGuide` / Options 提示文案，去掉「自动重建本地数据」表述

**A2. 清空 vs 重建对 personal 的差异**

- `clearAllSyncData({ preservePersonal })`：默认 `true` 跳过 personal 表
- 「重建」：已配个人私钥 → `preservePersonal: false`；未配置 → 保留仅本地个人数据；个人私钥始终不清除
- 「清空所有数据」：整应用全清（含验证器与个人私钥）
- 文件：`SyncEngine.reset.ts`、`clearAllLocalData.ts`、`useOptionsImportAndReset.ts`

**验收 A**

1. 本地有 totp → 生成个人私钥 → 列表仍在。  
2. 点「重建本地数据」→ 确认框警告个人同步数据也会清空 → 确认后本地 totp 被清，可从服务器 pull 回来。  
3. 「清空所有数据」→ 验证器与个人私钥均消失。

---

### 阶段 B — 密钥隔离加固（与 A 同 PR 或紧随）

**B1. Pull：scope ↔ key 绑定**

- 文件：`src/lib/sync/SyncEngine.pull.ts`（可抽 `assertKeyMatchesScope` 到 `syncKeys.ts`）
- 解密后：
  - `resolveDataScope(decrypted) === 'personal'` → 解密所用钥必须是 `personalKey`
  - `=== 'team'` → 必须是 `teamKey`
  - 无 `keyHash` 的历史 op：仅允许团队钥，且解密后 scope 不得为 personal / 不得写入 personal 表
- 不匹配：skip + `logger.warn`，不中断整批 pull

**B2. `resolveDataScope` 表级下限**

- 文件：`src/lib/sync/dataScope.ts`
- 规则：
  - 表默认 `personal` → **恒为 personal**（忽略实体 `dataScope:'team'`）
  - 表默认 `team` → 允许实体覆盖为 `personal`（为未来黑板预留）
  - 未知表：保持现有默认，但**不得**仅靠实体字段把未登记表当成可同步 personal 而不进表列表（本期不改注册模型）

**验收 B**

1. 人为用团队钥加密 `table=totpAccounts` 的 op → pull 后本地 totp 不变。  
2. totp payload 带 `dataScope:'team'` → push 仍用个人钥（或该 op 被当作 personal）。

---

### 阶段 C — 推送与数据一致性清理

**C1. 混合 batch 缺团队钥**

- 文件：`src/db/syncProvider.ts`
- 团队 op 无钥：`continue` + warn（与个人对称），不再 `throw`
- 整批皆 skip → `{ pushedIds: [] }`
- 若调用方需要「强制团队同步失败可见」，由上层在「仅团队、且存在待推团队 op」时单独判定并 toast（可选，非必须）

**C2. 统一软删判定**

- 新建或放入 `totpShared.ts` / 共用 util：`isSoftDeleted(item) => item.deletedAt != null`
- 替换：`totpQueries`、`totpShared.getTotpAccountOrThrow`、`totpMutations` 过滤、`PersonalSyncStatus`、`enqueuePersonalData` 中相关判断

**C3. 私钥按需导出（P3）**

- 文件：`usePersonalKeyManager.ts`
- `hasKey` 仅布尔；`keyString` 仅在 `showKey` 或复制时 `exportKey`；隐藏时清空

**验收 C**

1. 仅有个人钥、队列中混有团队 op → 个人 op 仍能 push。  
2. `deletedAt: null` 与 `undefined` 行为一致（均视为未删）。  
3. 未点「显示」时 React state 无完整私钥字符串。

---

### 阶段 D — 文档与口径

- 更新 `docs/personal-key-sync-design.md`：§6.3 与「阶段 C」中「配钥后自动 push 并重建」划掉；写明 clear 跳过 personal。  
- `README.md` / `CLAUDE.md`：若有「重建会清验证器」类表述，改为与上表一致。  
- 本计划文档状态改为「已实施」并附 PR / 提交链接。

---

## 5. 建议改动文件

| 文件 | 阶段 | 变更要点 |
|------|------|----------|
| `src/lib/sync/personalSyncBootstrap.ts` | A | 去掉 clear+pull；保留 enqueue |
| `src/features/settings/components/usePersonalKeyManager.ts` | A / C | 配钥后只 bootstrap；私钥按需导出 |
| `src/lib/sync/SyncEngine.reset.ts` | A | clear 跳过 personal；可选事后 enqueue |
| `src/entrypoints/options/useOptionsImportAndReset.ts` | A | 重建确认文案（明示个人数据保留） |
| `src/lib/sync/SyncEngine.pull.ts` | B | scope↔key 校验 |
| `src/lib/sync/syncKeys.ts` | B | 抽出匹配辅助函数 |
| `src/lib/sync/dataScope.ts` | B | 表级 personal 下限 |
| `src/db/syncProvider.ts` | C | 团队缺钥 skip |
| `src/lib/db/totpShared.ts` 等 | C | 统一 soft-delete |
| `src/features/totp/migrationGuide.ts` | A/D | 文案 |
| `docs/personal-key-sync-design.md` | D | 与实现对齐 |

不改：`clearAllLocalData` 的「清全部」语义；服务端 API；Dexie schema（除非软删 helper 发现需迁移，本期预期不需要）。

---

## 6. 风险与回滚

| 风险 | 缓解 |
|------|------|
| 重建后用户以为验证器也会从服务器「刷新」 | 文案说明：验证器以本机为准；换机靠个人私钥 + pull |
| 跳过 personal 后，错误的本机 totp 无法靠重建抹掉 | 引导：删账户 / 清空所有数据；不把重建当格式化 |
| Pull 校验过严导致合法个人 op 被 skip | 用 keyHash 与 personalHash 精确比较；加 debug 日志便于排障 |
| 团队缺钥改为 skip 后，用户不知团队数据未推 | PersonalSyncStatus 已有个人侧提示；团队侧可依赖现有同步错误/待推计数（若不足，另开小改） |

回滚：各阶段可独立 revert；优先保证 A 合入后不再发「配钥清库」版本。

---

## 7. 验证清单（合入前）

手动（Chrome 扩展 + 同步服务器）：

- [ ] 有本地 totp → 生成个人私钥 → 账户仍在；operations 出现 personal create  
- [ ] 同步后第二台导入同一私钥 → pull 恢复验证器  
- [ ] 更换个人私钥 → 本机 totp 仍在；可重新入队上传  
- [ ] 「重建本地数据」→ 确认框提示个人数据保留 → totp 保留；团队数据按预期恢复  
- [ ] 「清空所有数据」→ totp 与个人私钥均清除  
- [ ] 团队钥假 totp op → 本机不落库  
- [ ] 仅个人钥 + 队列混团队 op → 个人仍上传  
- [ ] `pnpm compile`、`pnpm lint` 通过  

---

## 8. 实施顺序建议

```text
A1 配钥去清库 ──┬── A2 clear 跳过 personal ──► 验收 A
                 │
                 └── B1 + B2 同 PR 更佳 ──► 验收 B
                                              │
                                              ▼
                                    C1 → C2 → C3 ──► 验收 C → D 文档
```

**推荐一次 PR 做完 A+B+C**，避免半修复状态合入；若需拆分：第一 PR 必须含 A1（否则仍有丢数据路径）。
