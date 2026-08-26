# D 仔测试用例物料库实施计划

> 状态：阶段 A-E 已实现；编辑、失败继续、并行执行和 TestRun 字段合并已纳入扩展实现
>
> 本文是下一次开发会话的实现依据。实现时应优先遵守本文已经确定的产品边界；如果代码现状与本文冲突，先检查本文的“关键提醒”和“实现前检查”，不要直接扩大范围。

## 1. 背景与目标

D 仔物料库暂定包含三类物料：

- 提示词
- 工作流
- 测试用例

本阶段只实现测试用例物料。提示词和工作流保留 UI 类型入口，但不创建数据、不提供新建和编辑逻辑，后续单独设计。

测试用例的核心流程是：

```text
用户用自然语言描述任务
  -> D 仔解析为结构化测试用例
  -> 信息完整后直接保存到团队共享测试用例库
  -> 用户从物料库发起执行
  -> D 仔按目标网页顺序逐步执行
  -> 每完成一个步骤就保存共享中间结果
  -> 保存最终测试报告
```

本阶段不做截图和录像。测试报告只保存文本结果、状态、执行时间和失败/阻塞原因。

## 2. 当前基线

### 2.1 已完成的前置清理

旧的测试功能已经移除：

- 旧测试 tab 已移除。
- 旧测试用例编辑器入口已移除。
- 旧测试执行服务和测试类型已移除。
- 旧 `testCases` / `testRuns` 表已经在 Dexie v17 迁移中删除。
- 旧 `feature_testing_enabled` 设置已在 v17 迁移中清理。

不要恢复旧测试功能的实现。新测试用例库使用本文定义的新数据模型和工具链。

### 2.2 已存在的 D 仔物料库 UI 壳

当前 D 仔内部已经有：

- “对话 / 物料库”视图切换。
- 物料类型筛选：全部、提示词、工作流、测试用例。
- 物料库空状态。
- 暂时禁用的搜索框和新建按钮。

下一阶段应在现有 D 仔模块内扩展，不新增侧边栏顶层 tab，不创建独立物料库页面。

重点文件：

- `src/features/aiAssistant/components/AIAssistantView.tsx`
- `src/features/aiAssistant/components/AIAssistantHeader.tsx`
- `src/features/aiAssistant/components/AIMaterialLibraryView.tsx`

## 3. 已确定的产品决策

### 3.1 测试目标网页

一个测试用例可以包含一个或多个明确的目标 URL。目标网页按顺序访问，并且属于同一个测试：

```text
A -> B -> C
```

不是对 A、B、C 分别创建三次独立测试。一个测试用例对应一次 `TestRun`，最终生成一份整体报告。

URL 必须明确指定，不使用当前页面作为隐式目标。当前活动页面可以作为浏览器子 Agent 的启动上下文，但不能替代测试用例中的目标 URL。

### 3.2 预期结果

第一版只保存自然语言预期结果：

```text
预期：登录后进入首页，并显示当前用户名称
```

第一版不做以下断言类型：

- 元素存在
- 文本包含
- URL 匹配
- CSS / DOM 选择器断言
- 可编排的断言表达式

D 仔执行网页步骤时负责根据自然语言预期结果判断结果，并返回实际结果和状态。

### 3.3 导入入口

测试用例导入在 D 仔内部完成，同时提供物料库按钮作为快捷入口。

点击“导入测试用例”后：

1. 创建一个新的 D 仔会话。
2. 切换到对话视图。
3. 将导入提示词填入输入框。
4. 不自动发送，用户可以继续编辑后发送。
5. D 仔在信息完整时直接保存到团队共享测试用例库。

不需要另一个独立的测试用例编辑器页面。

### 3.4 保存方式

用户明确要求解析完成后直接保存到共享库：

- 不保存到个人草稿库。
- 不增加额外的保存确认弹窗。
- 信息不完整时 D 仔必须追问，不能猜测后保存。
- 一次描述多个测试场景时，D 仔拆分成多条测试用例后批量保存。

这里的“直接保存”只表示产品流程不再要求用户二次确认；不表示敏感内容可以明文写入 IndexedDB 或同步载荷。见第 10 节。

### 3.5 执行确认与 YOLO

现有 YOLO 模式用于处理连续网页工具调用：

```text
普通模式：每次 delegate_browser_agent 都按现有机制请求确认
YOLO 模式：连续网页调用自动执行，不重复弹出确认
```

不新增一套测试专用的全局确认机制，也不因为测试流程而自动开启 YOLO。

用户需要自行决定是否在执行前开启 YOLO。

### 3.6 共享范围

以下内容全部属于团队共享数据：

- 测试用例物料。
- 测试执行记录。
- 测试报告。
- 执行中的中间步骤结果。

当前同步机制是最终一致，不承诺毫秒级实时更新。其他设备会在同步 pull 后看到新的执行进度。

## 4. 数据模型

### 4.1 物料类型

保留统一类型名，当前只允许写入 `testCase`：

```typescript
export type MaterialType = 'prompt' | 'workflow' | 'testCase';
```

提示词和工作流可以继续出现在 UI 筛选项中，但本阶段不创建对应记录。

### 4.2 测试用例内容

目标是让 D 仔将自然语言整理为可执行的、但仍然以自然语言为主的定义：

```typescript
export interface TestCaseTarget {
  id: string;
  order: number;
  name?: string;
  url: string;
}

export interface TestCaseStep {
  id: string;
  order: number;
  targetId: string;
  action: string;
  expectedResult?: string;
}

export interface TestCaseTestData {
  name: string;
  value: string;
  sensitive: boolean;
}

export interface TestCaseDefinition {
  goal: string;
  targets: TestCaseTarget[];
  preconditions: string[];
  testData: TestCaseTestData[];
  steps: TestCaseStep[];
  overallExpectedResult?: string;
  executionMode?: 'serial' | 'parallel';
}
```

说明：

- `targets` 必须至少有一个元素，按 `order` 顺序访问。
- 每个步骤通过 `targetId` 关联目标网页，避免 D 仔执行时重新猜测步骤属于哪个页面。
- `testData` 保存用户在自然语言中提供的账号、密码、Token 或其他输入值；敏感标记由 D 仔解析并由保存层校验。
- `testData.value` 不能写入日志、报告摘要或普通工具结果文本。
- `preconditions`、`action`、`expectedResult` 和 `overallExpectedResult` 都是自然语言。

### 4.3 测试用例物料

```typescript
export interface TestCaseMaterial {
  id: string;
  type: 'testCase';
  title: string;
  status: 'ready' | 'archived';
  version: number;
  encryptedContent: EncryptedData;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}
```

`encryptedContent` 至少包含以下内容的加密结果：

```typescript
interface TestCaseMaterialContent {
  sourceText: string;
  definition: TestCaseDefinition;
}
```

理由：用户需要在编辑和执行体验中看到完整值，但本地 IndexedDB 和同步载荷不能保存明文。标题、状态、版本和时间字段可以作为普通索引字段；测试描述、URL、账号、密码、Token 和步骤内容统一放进加密内容。

### 4.4 执行记录

```typescript
export type TestRunStatus = 'queued' | 'running' | 'passed' | 'failed' | 'blocked' | 'stopped';

export interface TestRun {
  id: string;
  testCaseMaterialId: string;
  testCaseVersion: number;
  status: TestRunStatus;
  currentStepId?: string;
  currentStepIds?: string[];
  encryptedContent: EncryptedData;
  startedAt: number;
  finishedAt?: number;
  updatedAt: number;
  deletedAt?: number;
}
```

`encryptedContent` 保存执行快照和报告：

```typescript
interface TestRunContent {
  testCaseSnapshot: TestCaseDefinition;
  report: TestReport;
}
```

必须保存 `testCaseSnapshot`，不能只保存测试用例 ID 和版本号。否则测试用例后续被修改后，历史报告无法还原当时执行的内容。

### 4.5 报告和步骤结果

```typescript
export interface TestStepResult {
  stepId: string;
  order: number;
  status: 'passed' | 'failed' | 'blocked' | 'skipped';
  actualResult?: string;
  detail?: string;
}

export interface TestReport {
  summary: string;
  stepResults: TestStepResult[];
  error?: string;
  updatedAt: number;
}
```

不要在 `TestReport` 中再次维护一个独立的最终状态。最终状态以 `TestRun.status` 为准，避免 `TestRun.status` 和 `TestReport.verdict` 不一致。

关系：

```text
TestCaseMaterial 1 : N TestRun
TestRun           1 : 1 TestReport
TestReport        1 : N TestStepResult
```

### 4.6 中间保存

执行状态按以下顺序更新：

```text
创建 TestRun             -> queued
开始执行                 -> running
开始一个步骤             -> currentStepId 更新
步骤完成                 -> stepResults 追加一条结果
所有步骤完成             -> passed / failed
执行中断                 -> stopped
无法继续                 -> blocked
```

每个测试步骤完成后更新一次 `TestRun`。不要把浏览器子 Agent 的每个 DOM 操作都写入 `TestReport`，浏览器任务原始 history 已经有自己的持久化路径，测试报告只记录测试步骤级结果。

## 5. Dexie 与同步实施

当前数据库最新版本是 v17。新功能使用 v18：

```typescript
db.version(18).stores({
  materials: '&id, type, status, updatedAt, deletedAt',
  testRuns: '&id, testCaseMaterialId, status, startedAt, updatedAt, deletedAt',
});
```

注意：v17 已经删除过旧的 `testRuns` 表；v18 可以重新创建同名的新表。不能修改历史 v13 或 v17 版本定义。

需要同步修改：

- `src/db/schema.ts`
- `src/db/typesDatabase.ts`
- `src/lib/sync/dataScope.ts`
- `src/db/syncEngine.ts`
- `src/lib/db/index.ts`
- 新增 `src/lib/db/materials.ts`
- 新增 `src/lib/db/testRuns.ts`

同步范围：

```typescript
TABLE_DATA_SCOPE.materials = 'team';
TABLE_DATA_SCOPE.testRuns = 'team';
```

并将两张表加入 `SyncEngine` 的表列表。不要加入 `PERSONAL_SYNC_TABLES`。

同步实现注意事项：

- 依赖现有 SyncEngine hooks 自动记录 create/update/delete。
- 删除使用软删除，保留同步冲突恢复能力。
- 每步更新会产生一次共享更新操作，属于本阶段可接受的成本。
- 使用现有团队密钥和 `encryptData` / `decryptData`，不要新增一套加密协议。
- 缺少团队密钥时，禁止创建或更新包含加密内容的共享测试用例，并给用户明确提示。
- Pull 后必须能在拥有团队密钥的设备上解密并显示完整测试内容。

## 6. D 仔导入流程

### 6.1 物料库按钮

当前 `AIMaterialLibraryView` 中的按钮暂时禁用。实现时：

- 选中“测试用例”筛选时显示“导入测试用例”。
- 点击后调用 D 仔的 `createNewSession`。
- 切换 `viewMode` 为 `chat`。
- 设置一个带唯一 token 的输入草稿，确保相同提示词连续使用时也能刷新输入框。
- 不要复用 `dpp_ai_preset_prompt` 的全局 storage 作为唯一通道；该机制可以继续兼容其他入口，但测试导入应走当前 React 状态。

现有 `createNewSession()` 返回 `Promise<void>`，不需要为了导入按钮强行改变为返回 session ID。调用完成后当前会话已经由 hook 更新，输入草稿可以直接交给当前 D 仔视图。

### 6.2 导入提示词

按钮预填以下内容，不自动发送：

```text
我需要把自然语言描述导入 DPP 的测试用例库。

请进入“测试用例导入”流程：
1. 引导我描述测试目标、目标网页、前置条件、操作步骤和预期结果。
2. 每个测试用例必须明确一个或多个目标 URL。
3. 多个目标 URL 按顺序访问，并属于同一个测试流程，例如 A -> B -> C。
4. 为每个步骤明确它所属的目标网页。
5. 预期结果只按自然语言记录，不要生成 DOM 选择器或可执行断言。
6. 账号、密码、Token 等用户明确提供的测试数据可以保留在测试用例中，但不要在普通回复、日志或报告中重复输出。
7. 这次只负责整理和导入测试用例，不要打开网页，也不要执行测试任务。
8. 信息不足时先向我提问，不要自行猜测。
9. 信息完整后，直接将结构化测试用例保存到团队共享测试用例库，并告诉我保存了哪些用例。
10. 一次描述多个测试场景时，拆分成多条独立测试用例。

我接下来会描述需要导入的测试用例。
```

### 6.3 D 仔导入规则

需要在 D 仔系统提示词中追加测试用例导入规则，至少包括：

- 当前导入模式只解析和保存，不执行网页操作。
- `targets` 不能为空，URL 必须是 `http://` 或 `https://`。
- `targets.order` 必须连续且唯一。
- 每个 step 必须有合法的 `targetId`。
- 用户只说“登录页”“管理后台”等模糊目标时，追问 URL。
- 用户没有说明多个 URL 的访问顺序时，追问顺序。
- 信息完整后调用 `test_case_import`，不要仅输出 Markdown 后声称已经保存。
- 工具返回成功后，才能告诉用户已经保存。
- 工具失败时必须明确报告失败，不得声称保存成功。

### 6.4 直接保存和校验

`test_case_import` 不需要额外的工具确认，因为产品流程已经明确要求解析完成后直接保存。

工具 handler 仍然必须做可信边界校验：

- 只接受对象或对象数组的合法结构。
- 拒绝空标题、空目标、空步骤。
- 拒绝非 HTTP(S) URL。
- 拒绝重复 target ID、重复 step ID 和不连续 order。
- 限制标题、自然语言字段、URL、步骤数量和测试数据数量，避免模型输出无限大对象。
- 规范化标题、URL 前后空白。
- 加密后再写入数据库。

## 7. D 仔执行流程

### 7.1 执行入口

物料库中的测试用例卡片提供“执行”入口。执行入口的行为与导入按钮一致：

1. 创建新的 D 仔会话。
2. 切换到对话视图。
3. 填入执行提示词。
4. 不自动发送。

建议预填：

```text
请执行测试用例：{title}
测试用例 ID：{id}

执行要求：
1. 先读取该测试用例的完整结构和目标 URL 顺序。
2. 创建一次新的测试执行记录。
3. 严格按照 A -> B -> C 的目标顺序执行，不跳过目标网页。
4. 一次只执行一个测试步骤，等待网页子 Agent 返回后再继续。
5. 每个步骤完成后立即保存该步骤的实际结果和状态。
6. 如果无法继续，保存 blocked 或 stopped 状态及原因，不要猜测为通过。
7. 全部步骤完成后保存最终测试报告。
8. 不要截图，不要录像。
```

### 7.2 AI 工具职责

第一版建议注册这些工具：

```text
test_case_list
test_case_get
test_case_import
test_run_start
test_run_update_step
test_run_finish
delegate_browser_agent
```

职责边界：

- `test_case_list`：供 D 仔按标题查找共享测试用例。
- `test_case_get`：读取并解密测试用例完整内容。
- `test_case_import`：接收解析后的一个或多个测试用例并直接共享保存。
- `test_run_start`：创建执行记录，保存测试用例快照并返回 run ID。
- `test_run_update_step`：保存当前步骤和中间结果。
- `test_run_finish`：保存最终状态、总结和失败原因。
- `delegate_browser_agent`：执行当前一个网页步骤。

不要新增一个包办全部执行流程的 `test_case_execute` 工具。D 仔自身负责串行编排，现有 YOLO 模式负责连续工具确认策略。

### 7.3 工具调用顺序

```text
test_case_get
  -> test_run_start
  -> test_run_update_step(currentStepId)
  -> delegate_browser_agent(目标 URL + 当前步骤)
  -> test_run_update_step(实际结果 + 状态)
  -> test_run_update_step(下一个 currentStepId)
  -> delegate_browser_agent(...)
  -> test_run_update_step(...)
  -> test_run_finish
```

系统提示词必须要求 D 仔一次只委派一个网页步骤。不能让模型一次性生成整组 `delegate_browser_agent` 调用，否则步骤结果和失败恢复顺序会变得不可靠。

### 7.4 浏览器目标 URL

现有 `delegate_browser_agent` 依赖当前活动 HTTP 标签页。如果当前没有可用的 HTTP(S) 活动页，仅仅在 task 文本中要求“打开 URL”是不够的，工具在读取活动 tab 时就会失败。

实现时必须补充一个明确的目标页启动方案，二选一：

1. 为 `delegate_browser_agent` 增加可选的 `initial_url`，没有可用活动页时先创建/激活该 URL。
2. 在测试执行入口中先创建/激活第一个目标 URL，再调用浏览器子 Agent。

建议使用方案 1，并保持普通网页任务的 `initial_url` 可选，不改变原有调用行为。

每次进入下一个 target 时，D 仔的当前步骤任务必须明确目标 URL；浏览器子 Agent 可以在当前任务内打开目标，但不能凭空选择 URL。

### 7.5 网页子 Agent 的步骤结果

现有 `delegate_browser_agent` 返回：

```typescript
{
  success: boolean;
  message: string;
}
```

`success` 只表示子任务完成，不能自动等同于测试预期通过。测试步骤任务提示词应要求浏览器子 Agent：

- 执行当前步骤。
- 对照当前步骤的自然语言预期结果。
- 返回是否满足预期。
- 返回实际观察到的结果。
- 不扩展到下一个测试步骤。

推荐要求返回受限 JSON，并在 DPP 侧做校验：

```json
{
  "status": "passed | failed | blocked",
  "actualResult": "实际观察结果",
  "detail": "补充说明"
}
```

解析失败时只能标记为 `blocked`，不能把无法解析的结果标记为 `passed`。解析器必须使用 `unknown` 和显式类型守卫，不能使用 `any`。

### 7.6 中间报告更新

每个步骤完成后执行一次 `test_run_update_step`：

```text
TestRun.status = running
TestRun.currentStepId = 下一个步骤 ID
TestReport.stepResults += 当前步骤结果
TestReport.updatedAt = 当前时间
```

失败时：

- 当前步骤写入 `failed` 或 `blocked`。
- `failed` 步骤保存后允许继续后续步骤；`blocked` 或 `stopped` 后停止相关执行。
- 全部步骤结束后，`TestRun.status` 更新为 `failed` 或 `blocked`。
- `TestReport.error` 写入可读原因。
- `failed` 允许继续后续步骤；`blocked` 和 `stopped` 不继续。

停止时：

- 保留已完成步骤。
- 当前步骤标记为 `blocked` 或 `skipped`，实现时统一一种规则。
- `TestRun.status = stopped`。

## 8. UI 实施计划

### 8.1 物料库列表

在现有 `AIMaterialLibraryView` 中实现：

- 测试用例列表。
- 按标题和解密后的内容搜索。
- 测试用例筛选状态。
- 最近更新时间。
- 当前版本。
- 最近一次执行状态。
- 导入测试用例按钮。

由于正文加密，正文搜索应在加载并解密后的内存数组上进行。第一版数据量预计较小，不新增全文索引。

### 8.2 测试用例详情

点击测试用例后显示：

- 标题和测试目标。
- 目标 URL 顺序 A -> B -> C。
- 前置条件。
- 测试数据，用户可看到完整值。
- 步骤和自然语言预期结果。
- 版本和更新时间。
- 执行按钮。
- 手动编辑按钮和完整编辑表单。
- 保存时校验版本并递增物料版本。
- 历史执行记录入口。

不做独立 Monaco 编辑器，使用结构化表单编辑标题、描述、目标 URL、执行模式、前置条件、测试数据和步骤。

### 8.3 执行报告

报告详情显示：

- 当前执行状态。
- 目标 URL 顺序。
- 当前步骤。
- 已完成步骤结果。
- 每步的预期和实际结果。
- 总结。
- 失败、阻塞或停止原因。
- 执行开始和结束时间。

不显示截图、录像入口，不新增录像关联字段。

### 8.4 空状态与未实现类型

- 提示词和工作流继续显示为空状态。
- 不显示会让用户误以为已经可用的“新建提示词”“新建工作流”按钮。
- 测试用例筛选中的“导入测试用例”按钮可用。
- “全部”筛选下可以显示测试用例，也可以显示统一空状态，取决于列表实现；不能显示虚假的提示词/工作流数据。

## 9. 加密与敏感信息注意事项

### 9.1 用户体验要求

用户明确要求：

- 测试用例编辑界面显示完整账号、密码、Token 等值。
- D 仔执行测试时可以读取和使用完整值。
- 不使用变量占位符。
- 不要求每次执行时重新输入。

### 9.2 存储要求

项目安全规则仍然适用：敏感内容不能明文存储或明文同步。

实现方式：

```text
用户输入真实值
  -> D 仔解析
  -> 保存层使用现有团队密钥加密完整 content
  -> IndexedDB 保存密文
  -> SyncEngine 传输密文
  -> 读取时解密到内存
  -> UI 显示完整值
```

不要把 `sourceText`、`definition`、`testCaseSnapshot` 或 `report` 的明文直接写入普通数据库字段。

### 9.3 日志、报告和 AI 消息

- logger 不得输出测试数据明文。
- 工具错误信息不得拼接完整密码、Token 或 API Key。
- 报告摘要和步骤实际结果不得主动重复敏感值；使用“已输入密码”“认证成功”等描述。
- 当前 D 仔用户消息可能由现有 AI persistence 保存。实现时必须检查导入流程是否会把敏感源文本长期写入 `aiMessages`；如会，至少需要对导入专用消息做脱敏或加密处理，不能只加密 `materials` 表而忽略聊天历史。
- 不把敏感值放进 `BrowserTaskSummary.activity`、普通通知或同步日志。
- 调试页面只允许经过现有敏感字段处理后展示数据。

### 9.4 外部 AI Provider 风险

为了执行测试，D 仔和网页子 Agent 可能需要在请求中看到用户提供的真实测试数据。实现文档不应声称“全程不离开本机”；正确表述是：

- 本地数据库和同步载荷加密。
- 只在执行必需的上下文中发送。
- 不在普通报告和日志中回显。
- 不额外扩大到无关工具或网页任务。

## 10. 错误处理与恢复

所有异步数据库和浏览器操作都必须：

- 使用 `try/catch`。
- 使用 `logger.error` 记录不含敏感值的错误。
- 使用 `toast` 给用户反馈。
- 不产生 floating promise；事件回调中的异步操作显式 `void`。

需要覆盖：

- 没有团队密钥，无法保存共享测试用例。
- D 仔解析结果格式错误。
- URL 不合法。
- 测试用例不存在或已归档。
- 测试用例解密失败。
- TestRun 创建失败。
- 浏览器没有可用 HTTP(S) 页面。
- 目标 URL 无法打开。
- 网页任务等待用户接管。
- 网页任务超时、失败或被停止。
- 中间步骤保存失败。
- 同步失败。
- 远端更新覆盖本地旧版本。

中间保存失败时不能继续假装执行成功。应将 TestRun 标记为 `blocked`，保存错误原因，并停止后续步骤。

## 11. 并发与同步冲突

默认一个 TestRun 由一个 D 仔会话执行，但多个客户端的更新可以安全合并。多个成员可以同时执行同一个 TestCaseMaterial，但每次执行必须创建不同的 TestRun ID。

需要避免：

- 两个客户端写同一个 TestRun 时整条记录互相覆盖。
- 同一个 D 仔会话同时启动两个测试执行。
- 一个测试步骤的旧结果覆盖新结果。

建议在 `TestRun` 中保存执行会话标识和创建时间；如果当前没有稳定的用户身份系统，不要伪造用户名称，可以只保存 `sessionId` 或同步 client ID 作为技术追踪字段。

TestRun 同步按步骤结果、当前步骤集合、最终报告字段做合并；同一个步骤的冲突按较新的更新保留。其他表仍按 `updatedAt` 做最后写入判断。

## 12. 推荐实施顺序

### 阶段 A：类型和数据库

- 新增测试用例、执行记录、报告类型。
- 新增 Dexie v18 的 `materials`、`testRuns`。
- 写迁移和加密内容读写辅助函数。
- 增加 `DPPDatabase` 表类型。
- 把两张表加入团队 SyncEngine。
- 实现 `list/get/import/updateRun` 基础数据库操作。

验收：新库可打开，旧 v17 数据升级不报错，测试数据不会明文落盘。

### 阶段 B：AI 导入工具

- 注册 `test_case_list`、`test_case_get`、`test_case_import`。
- 增加工具参数结构和运行时校验。
- 将测试用例导入规则追加到 D 仔系统提示词。
- 编写批量导入和缺失信息追问逻辑。
- 完善工具返回结果和错误文案。

验收：用户自然语言描述完整后，D 仔能直接保存一条或多条共享测试用例；不完整描述不会保存。

### 阶段 C：导入按钮和物料库列表

- 启用测试用例筛选下的导入按钮。
- 实现新会话和输入草稿注入。
- 读取、解密并展示测试用例。
- 实现标题/正文搜索和测试用例详情。
- 处理加载、解密失败和空状态。

验收：按钮能正确进入新 D 仔会话，输入框有预填提示词；其他物料类型仍保持空实现。

### 阶段 D：执行工具和逐步报告

- 注册 `test_run_start`、`test_run_update_step`、`test_run_finish`。
- 增加测试执行提示词、失败继续规则和可选的并行步骤规则。
- 确保目标 URL 可以被浏览器任务启动。
- 为单步骤网页任务设计返回结构并做解析校验。
- 每步完成后保存共享中间结果。
- 失败、阻塞、停止和超时都保存部分报告。
- 复用现有 YOLO，不新增测试专用确认开关。

验收：serial 模式按 A -> B -> C 执行，parallel 模式可在独立标签页执行互不依赖目标；普通模式按现有确认策略工作；YOLO 模式可连续执行；每步结果都能在其他客户端同步后看到。

### 阶段 E：报告 UI 和完整验证

- 显示当前执行进度。
- 显示历史 TestRun。
- 显示 TestReport 和每步结果。
- 添加删除/归档策略前先确认是否需要；第一版可以只读历史记录。
- 增加最小数据库、解析和执行状态测试。
- 完成 compile、lint、build。

## 13. 建议的文件边界

数据和领域类型：

- `src/features/aiAssistant/materials/types.ts`
- `src/features/aiAssistant/materials/testCaseTypes.ts`
- 或统一放入 `src/features/aiAssistant/typesMaterials.ts`，只选一种，不要同时建立重复类型。

数据库：

- `src/lib/db/materials.ts`
- `src/lib/db/testRuns.ts`
- 必要时增加 `materialsShared.ts` / `testRunsShared.ts`，只有存在实际复用时再拆分。

AI 工具：

- `src/lib/ai/tools/testCases.ts`
- `src/lib/ai/tools/testRuns.ts`
- `src/lib/ai/toolsRegistration.ts`
- `src/features/aiAssistant/components/toolConfirmationShared.ts` 只在需要新增显示文案时修改；`test_case_import` 不需要确认弹窗。

提示词：

- `src/lib/ai/promptTestCases.ts`
- `src/lib/ai/promptShared.ts`
- `src/lib/ai/prompt.ts`

UI：

- `src/features/aiAssistant/components/AIMaterialLibraryView.tsx`
- 必要时新增 `AIMaterialTestCaseList.tsx`、`AIMaterialTestCaseDetail.tsx`、`AITestRunReport.tsx`。
- 只有组件实际变复杂时才拆文件。

## 14. 明确不做的内容

本阶段不要实现：

- 代码片段类型。
- 提示词和工作流的实际存储与编辑。
- 结构化断言 DSL。
- DOM 选择器编辑器。
- 截图和录像。
- 独立测试用例编辑器 HTML 入口。
- 自动开启 YOLO。
- 测试失败后自动继续和多目标 URL 的并行执行已支持；仍不做失败后自动重试同一个网页操作。
- 复杂版本历史表；先保存执行快照。
- 远端实时协作协议；先复用现有最终一致同步。
- 自动清理历史报告。

## 15. 验收清单

### 导入

- [ ] 从物料库按钮进入新 D 仔会话。
- [ ] 输入框自动填入导入提示词，但不自动发送。
- [ ] D 仔能识别单个和多个测试用例。
- [ ] 每个测试用例至少有目标 URL、目标和步骤。
- [ ] 多个目标按 A -> B -> C 保存。
- [ ] 每个步骤有合法的目标网页关联。
- [ ] 信息不完整时不会保存。
- [ ] 完整后直接保存到共享库。
- [ ] 保存失败时不声称成功。

### 数据与安全

- [ ] v17 -> v18 升级成功。
- [ ] 测试用例和 TestRun 属于团队同步范围。
- [ ] 用户在 UI 可看到完整测试值。
- [ ] 数据库和同步载荷不保存敏感内容明文。
- [ ] 日志、普通报告和错误不回显敏感值。
- [ ] 解密失败有可读错误提示。

### 执行

- [ ] 执行入口进入新 D 仔会话。
- [ ] 先读取测试用例并创建 TestRun。
- [ ] 目标网页按 A -> B -> C 顺序访问。
- [ ] 一次只执行一个测试步骤。
- [ ] 普通模式确认行为符合现有工具确认机制。
- [ ] YOLO 模式不重复确认每个网页步骤。
- [ ] 每个步骤结束后保存中间报告。
- [ ] 失败、阻塞、停止和超时保留部分结果。
- [ ] 最终状态和报告一致。
- [ ] 其他客户端同步后可以读取执行进度和报告。

### 工程质量

- [ ] `pnpm compile` 通过。
- [ ] `pnpm lint` 通过。
- [ ] `pnpm build` 通过。
- [ ] 没有 `any`、`@ts-ignore` 或 `@ts-expect-error`。
- [ ] 没有 floating promise。
- [ ] 没有恢复旧测试功能入口。

## 16. 实现时的关键提醒

1. 不要把“用户确认后直接保存”和“敏感数据明文落盘”混为一谈。
2. 不要把 `TestRun.status` 和报告里的另一个 verdict 分开维护。
3. 不要只保存测试用例 ID，必须保存执行时快照。
4. 不要让模型一次性生成所有网页调用；必须按步骤串行。
5. 不要依赖当前活动 tab 替代显式目标 URL。
6. 不要把浏览器子 Agent 的原始 history 当成测试步骤报告；两者粒度不同。
7. 不要因为有 YOLO 就自动开启它；YOLO 必须是用户主动选择。
8. 不要在提示词、日志、报告和工具错误中回显密码或 Token。
9. 不要为了提示词和工作流提前建立完整业务模型；当前只实现 testCase。
10. 每完成一个阶段先运行最小验证，再进入下一阶段。

## 17. 实现前检查

产品层面的关键决策已经确定，没有需要再次向用户确认的开放项：

- 目标网页按 A -> B -> C 顺序访问，属于同一个测试用例和同一个 TestRun。
- 预期结果只保存自然语言，不实现可执行断言。
- 导入在 D 仔中完成，物料库按钮只负责创建新会话和预填提示词。
- 解析完整后直接写入团队共享测试用例库，不弹额外保存确认框。
- 测试用例、TestRun、中间结果和报告全部团队共享。
- 用户界面显示完整测试数据，数据库和同步载荷使用现有团队密钥加密。
- 普通模式按现有工具确认机制执行，YOLO 由用户主动开启，不能自动开启。
- 不做截图、录像、代码片段、提示词和工作流的实际实现。

下一会话开始编码前，只需要检查当前工作区是否已经出现新的用户改动，以及确认现有 `src/lib/crypto/encryption.ts` 的加密数据类型和团队密钥加载 API；不要重新设计已经确定的产品行为。
