# 个人同步修复计划

> 状态：已实施；**配钥路径后续在 `5456f5a` 改回「push 后 clear + pull」**，以当前代码与 `personal-key-sync-design.md` §6.3 为准。  
> 背景：代码审查覆盖提交 `48e7437`（本地 TOTP + 个人私钥）与未提交的双钥 SyncEngine 接入。  
> 关联设计：[`personal-key-sync-design.md`](./personal-key-sync-design.md)

---

## 1. 目标

在不推翻「个人私钥 + 同服务器 SyncEngine」架构的前提下：

1. **加固个人同步数据安全**（pull key↔scope、表级 personal 下限、混合 batch skip 等）。
2. **堵住团队钥写入/加密个人表的路径**（P1）。
3. **同步清除与整机清空职责分离**：默认 `clearAllData` 可保留 personal；显式重建 / 配钥后重建可清 personal；工厂重置仍清全部。
4. 顺带修复软删判定、私钥内存暴露等次要问题。

非目标（本期不做）：本地 secret vault、实体级黑板私人笔记 UI、自动化单测框架搭建。

---

## 2. 问题清单与对策一览

| 级别 | 问题 | 对策（历史） | 当前代码 |
|------|------|--------------|----------|
| P0 | 配钥后 `clearAllData` + `pull` 与 pull 过滤本 `clientId` 叠加可能丢 totp | 曾改为配钥只 enqueue（+ 可选 push） | **`5456f5a` 起**：配钥/换钥再次走 enqueue → push → clear + pull（依赖现网 pull 信封常无 `clientId`；风险见设计文档） |
| P0 相关 | `clearAllSyncData` 会清掉 `totpAccounts` | 默认 `preservePersonal: true` 跳过 personal | 仍默认跳过；重建 / 配钥 finalize 显式传 `false` |
| P1 | Pull 只认 `keyHash`，团队密文可写入个人表 | 解密后校验 scope ↔ 密钥角色 | 已落地 |
| P1 | 实体 `dataScope:'team'` 可覆盖表默认 personal | 表级 personal 为下限 | 已落地 |
| P2 | 缺团队钥时混合 batch `throw`，堵住个人上传 | 团队缺钥改为 skip | 已落地 |
| P2 | `deletedAt` 对 `null` 判定不一致 | 统一 soft-delete helper | 已落地 |
| P3 | 个人私钥常驻 React state | 仅展示/复制时导出 | 已落地 |

---

## 3. 产品行为约定（与当前代码对齐）

### 3.1 个人私钥写入

| 动作 | 行为 |
|------|------|
| 生成个人私钥 | 保存密钥 → `enqueuePersonalData` → `push` → **`clearAllData({ preservePersonal: false })` → `pull`** |
| 导入个人私钥 | 同上 |
| 更换/覆盖个人私钥 | 强确认 → 保存新钥 → 同上；云端旧个人密文作废（keyHash 不匹配） |
| 启动时 bootstrap（已有钥、未标记） | 仅 enqueue + 打标；**不做** clear/pull |

Toast 口径：推送个人数据并完成本地数据重建；失败提示检查同步配置后手动同步（密钥已保存不回滚）。

### 3.2 跨设备恢复

设备 B：导入同一把个人私钥 → 走 3.1（含重建）；或导入后依赖后续正常同步 pull。  
本地若几乎为空，pull 即可恢复他机推送的个人密文。

### 3.3 清除 / 重建

| 入口 | 个人表（`totpAccounts` 等） | 团队同步表 | 个人私钥 |
|------|------------------------------|------------|----------|
| 配钥 / 换钥 finalize | **清空**后 pull | 清空后 pull | **保留** |
| 重建（已配个人私钥） | **清空**后 pull | 清空后 pull | **保留** |
| 重建（未配个人私钥） | **保留**（仅本地，无法从服务器恢复） | 清空后 pull | 无 |
| 导入配置 | **清除**（导入后需重新同步） | **清除** | **保留**（及 `personal_sync_bootstrap_done`） |
| 清空所有数据 | **清除** | 清除 | **清除** |
| 换团队钥 member `clearAllData()` | **保留**（默认） | 清空后 pull | 保留 |

---

## 4. 实施步骤

### 阶段 A — 数据安全（必须先合）

**A1. 配钥路径（历史 → 现状）**

- 文件：`src/lib/sync/personalSyncBootstrap.ts`、`src/features/settings/components/usePersonalKeyManager.ts`
- 历史修复曾删除 finalize 中的 `clearAllData` + `pull`，只保留 enqueue（+ 可选 push）
- **当前**：`finalizePersonalSyncAfterKeyReady` 为 enqueue → push → clear（`preservePersonal: false`）→ pull；启动 bootstrap 仍只 enqueue
- 文案 / `migrationGuide` / Options / 设计 §6.3 须与上表一致

**A2. 清空 vs 重建对 personal 的差异**

- `clearAllSyncData({ preservePersonal })`：默认 `true` 跳过 personal 表
- 「重建」：已配个人私钥 → `preservePersonal: false`；未配置 → 保留仅本地个人数据；个人私钥始终不清除
- 「导入配置」：删库重建设置前先暂存并回写 `personal_encryption_key` / `personal_sync_bootstrap_done`；确认文案须标明个人私钥保留
- 「清空所有数据」：整应用全清（含验证器与个人私钥）
- 个人私钥配置前置：须已保存非空 `custom_server_url`；未配置时 Options 不展示生成/导入入口，hook 侧二次校验
- 文件：`SyncEngine.reset.ts`、`clearAllLocalData.ts`、`useOptionsImportAndReset.ts`、`PersonalKeyManager`、`syncServerConfig.ts`

**验收 A**

1. 本地有 totp + 同步可用 → 生成个人私钥 → push 后重建，列表应能从服务器恢复。  
2. 点「重建本地数据」→ 确认后本地 totp 被清，可从服务器 pull 回来（已配个人私钥时）。  
3. 「清空所有数据」→ 验证器与个人私钥均消失。  
4. 已配个人私钥 →「导入配置」→ 个人私钥仍在；未配同步服务器时无法生成/导入个人私钥。

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

- 更新 `docs/personal-key-sync-design.md`：§6.3 / 阶段 C 与实现一致（配钥后 push → clear + pull；默认 clear 跳过 personal）。  
- `README.md` / `CLAUDE.md` / Options / `migrationGuide`：与 §3 表一致。  
- 本计划文档状态标明 `5456f5a` 后的配钥约定。

---

## 5. 建议改动文件

| 文件 | 阶段 | 变更要点 |
|------|------|----------|
| `src/lib/sync/personalSyncBootstrap.ts` | A | finalize：enqueue → push → clear + pull；bootstrap 仅 enqueue |
| `src/features/settings/components/usePersonalKeyManager.ts` | A / C | 配钥后 finalize；私钥按需导出；文案对齐 |
| `src/lib/sync/SyncEngine.reset.ts` | A | clear 默认跳过 personal；重建可传 false |
| `src/entrypoints/options/useOptionsImportAndReset.ts` | A | 重建确认文案 |
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
| 配钥后 push 成功但 pull 失败 → 本地同步表已空 | 文案提示手动同步；后续应考虑 pull 失败不清库或可恢复 |
| 服务端若开始回传 `clientId`，pull 过滤本机 op → 重建丢本机刚推数据 | 与服务端协议对齐前勿依赖「清库靠 pull 找回」；或配钥路径去掉 clear |
| 跳过 personal 后，错误的本机 totp 无法靠默认 clear 抹掉 | 用「重建」（已配钥）或「清空所有数据」 |
| Pull 校验过严导致合法个人 op 被 skip | 用 keyHash 与 personalHash 精确比较；加 debug 日志便于排障 |
| 团队缺钥改为 skip 后，用户不知团队数据未推 | PersonalSyncStatus 已有个人侧提示；团队侧可依赖现有同步错误/待推计数 |

回滚：可独立 revert 配钥 finalize 中的 clear+pull，回到仅 enqueue（+ push）。

---

## 7. 验证清单（合入前）

手动（Chrome 扩展 + 同步服务器）：

- [ ] 有本地 totp → 生成个人私钥 → push/重建成功后账户仍可从服务器恢复  
- [ ] 同步后第二台导入同一私钥 → 重建/pull 恢复验证器  
- [ ] 更换个人私钥 → 本机经 push+重建后可用新钥同步  
- [ ] 「重建本地数据」（已配个人私钥）→ totp 清空后可从服务器恢复  
- [ ] 「清空所有数据」→ totp 与个人私钥均清除  
- [ ] 团队钥假 totp op → 本机不落库  
- [ ] 仅个人钥 + 队列混团队 op → 个人仍上传  
- [ ] `pnpm compile`、`pnpm lint` 通过  

---

## 8. 实施顺序建议

```text
A1 配钥路径（现为 push→clear→pull） ──┬── A2 clear 默认跳过 personal ──► 验收 A
                                       │
                                       └── B1 + B2 ──► 验收 B
                                                        │
                                                        ▼
                                              C1 → C2 → C3 ──► 验收 C → D 文档
```

**推荐一次 PR 做完 A+B+C**；文档与 UI 文案必须与 §3 当前约定一致。
