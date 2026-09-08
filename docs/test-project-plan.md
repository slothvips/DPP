# 测试项目合集实施计划

## 目标

新增“项目”作为多个测试用例的合集。一个测试用例仍然代表一个独立测试场景，项目只负责组织和批量执行测试用例。

```text
项目
├── 测试用例 A
├── 测试用例 B
└── 测试用例 C
```

## 已确认规则

- 每次导入默认创建一个全新的项目。
- 不根据项目名称自动复用历史项目。
- 用户明确要求加入已有项目时，才允许复用已有项目。
- 同名新项目追加时间后缀，例如 `登录回归测试-20260907-143015`。
- 时间后缀和冲突序号由工具层生成。
- 一次导入中的多个测试场景拆分为多条测试用例，并归入本次创建的项目。
- 项目中某条测试用例失败后，继续执行剩余测试用例。
- `blocked` 或 `error` 结束当前测试用例，但项目继续执行后续用例。
- 用户主动停止时，停止整个项目执行。
- 旧测试用例保留，不强制回填到项目。
- 删除项目不删除测试用例和历史执行记录。
- 删除测试用例时，项目保留失效引用并提示处理。

## 数据模型

新增 `TestProject`：

- `id`
- `title`
- `status`
- `version`
- `encryptedContent`
- `createdAt`
- `updatedAt`
- `deletedAt`

项目加密内容包括：

- `description`
- 有序测试用例引用
- `testCaseMaterialId`
- `order`
- `enabled`

扩展 `TestRun`：

- `projectRunId?: string`

新增 `TestProjectRun`：

- `id`
- `projectId`
- `projectVersion`
- `sessionId?`
- `status`
- `encryptedContent`
- `startedAt`
- `finishedAt?`
- `updatedAt`
- `deletedAt?`

项目执行快照保存项目标题、项目版本、测试用例 ID、测试用例版本、测试用例标题、每条子测试用例的 `testRunId`、执行状态和错误信息。

项目不是 `MaterialRecord` 类型，不混入 prompt、role、conversation 物料体系。

## 数据库和同步

需要修改：

- `src/features/aiAssistant/materials/testCaseTypes.ts`
- `src/db/typesDatabase.ts`
- `src/db/schema.ts`
- `src/lib/db/index.ts`
- `src/db/syncEngine.ts`
- `src/lib/sync/dataScope.ts`
- `src/lib/sync/SyncEngine.apply.ts`
- `src/lib/sync/testRunMerge.ts`

新增 Dexie v26：

- `testProjects`
- `projectRuns`
- `testRuns.projectRunId` 索引

同步范围增加 `testProjects` 和 `projectRuns`，并将二者标记为团队数据、使用团队密钥加密。

项目定义按版本和更新时间处理。项目执行记录不能简单采用最后写入覆盖，需要保留已经完成的子测试用例结果。

旧数据不迁移，旧测试用例保持未归属状态。

## 导入流程

需要修改：

- `src/lib/ai/promptTestCases.ts`
- `src/lib/ai/tools/testCases.ts`
- `src/lib/ai/toolsRegistration.ts`
- `src/features/aiAssistant/components/AIAssistantView.tsx`

保留 `test_case_import` 工具名以减少兼容影响，但改变其语义：

- 默认创建新项目。
- 参数增加项目名称和项目描述。
- 仅允许通过明确的 `existing_project_id` 加入已有项目。
- 工具返回项目 ID、项目名称和测试用例列表。
- 项目创建和测试用例导入必须避免部分成功。
- 项目名称、描述和测试用例标题都要进行敏感信息脱敏。

提示词必须明确：

```text
每次导入默认创建新项目。
不得按名称自动复用历史项目。
只有用户明确要求加入已有项目时，才允许查询并复用该项目。
同一批次中的多个测试场景拆分成多条测试用例，统一归入本次项目。
```

名称生成规则：

- 用户有项目名称时使用用户名称。
- 没有项目名称时，根据本次导入内容生成基础名称。
- 已存在同名项目时追加时间后缀。
- 同一时间后缀仍冲突时追加序号。
- 最终名称由数据库服务或工具层生成，不能完全依赖模型。

## 项目执行

新增项目执行工具：

- `test_project_execute`
- `test_project_report`

保留单条执行工具：

- `test_run_execute`
- `test_run_report`

需要修改：

- `src/lib/ai/tools/testRuns.ts`
- 新增项目执行工具模块
- `src/lib/ai/toolsRegistration.ts`
- `src/lib/ai/promptTestCases.ts`

执行流程：

1. 创建项目执行记录。
2. 固定项目和测试用例版本快照。
3. 按项目顺序串行执行测试用例。
4. 每条用例创建独立 `TestRun`。
5. 用例结束后更新项目执行报告。
6. 失败、阻塞或技术错误后继续下一条。
7. 所有用例完成后计算项目最终状态。

项目最终状态：

- 全部通过：`passed`
- 存在失败：`failed`
- 没有失败但存在阻塞：`blocked`
- 存在技术错误：`error`
- 用户停止：`stopped`

需要抽取现有单条测试执行逻辑，避免项目执行复制整套浏览器任务代码。

## 停止、取消和恢复

需要修改：

- `src/lib/ai/tools/testRuns.ts`
- `src/features/aiAssistant/services/executeToolCalls.ts`
- `src/features/aiAssistant/hooks/useAIChatToolFlow.ts`
- `src/features/aiAssistant/hooks/useAIChatRuntime.ts`
- 相关浏览器任务清理逻辑

需要支持：

- 查找当前会话活动项目执行。
- 停止项目父记录和当前子测试记录。
- 项目执行工具错误时停止浏览器任务。
- 用户取消会话时停止项目执行。
- 页面刷新后通过 `sessionId` 恢复项目执行状态。
- 每个子测试完成后释放对应浏览器任务资源。

## 界面

需要修改：

- `src/features/aiAssistant/components/AIMaterialLibraryView.tsx`
- `src/features/aiAssistant/components/AIAssistantView.tsx`

增加项目视图：

- 项目列表。
- 项目名称、用例数量、最近执行结果。
- 项目详情。
- 测试用例添加、移除、排序。
- 测试用例启用/禁用。
- 执行项目。
- 项目执行历史。
- 展开查看每条测试用例的报告。

测试用例保留单独执行、单条执行历史、编辑和删除能力。

删除测试用例后，项目中保留失效引用并提示用户处理；删除项目不删除测试用例和历史执行记录。

## 搜索和审计

需要修改：

- `src/lib/ai/tools/dppSearchShared.ts`
- `src/lib/ai/tools/dppSearch.ts`
- `src/lib/sync/auditHistoryModel.ts`
- `src/features/audit/auditHistory.ts`
- `src/entrypoints/audit/main.tsx`

增加项目搜索源 `test_projects`，并让审计历史支持项目和项目执行表、项目加密内容解密及中文显示名称。

将项目表加入同步表后，确认 `clearAllSyncData` 能正确清理；验证全量本地清理不会遗留项目数据。

## 工具权限

- `test_project_execute` 需要确认。
- 项目导入沿用当前测试用例导入的直接保存策略。
- 角色使用 `allowlist` 时，新项目工具需要出现在工具选择范围中。
- 多工具调用继续遵守 `manage_plan` 的多步骤计划要求。

## 测试

需要新增或修改：

- `tests/syncMigration.test.mjs`
- `tests/aiTools.test.mjs`
- `tests/browserTask.test.mjs`
- `tests/auditHistory.test.mjs`
- `tests/prompts.test.mjs`
- 项目状态聚合测试
- 项目执行器测试

覆盖范围：

- v26 数据库迁移。
- 每次导入创建新项目。
- 同名项目时间后缀。
- 明确指定已有项目时才复用。
- 多场景拆分。
- 导入失败不产生孤立项目或孤立用例。
- 项目版本和测试用例版本快照。
- 失败后继续执行。
- 项目停止和取消。
- 页面刷新恢复。
- 同步冲突合并。
- 审计历史。
- 项目搜索。
- 敏感信息脱敏。

## 实施顺序

1. 类型、数据库表和 Dexie v26。
2. 项目 CRUD、命名和原子导入。
3. 同步、加密归属和冲突合并。
4. AI 导入提示词和工具。
5. 单条测试执行逻辑抽取。
6. 项目执行、停止和恢复。
7. 项目列表和详情界面。
8. 搜索、审计和清理联动。
9. 补充测试。
10. 执行 `pnpm compile`、`pnpm lint:fix`、`pnpm build`。
