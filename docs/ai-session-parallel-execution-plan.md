# D 仔多会话并行与网页子任务并行实施计划

## 1. 目标

实现以下能力：

- 不同 D 仔会话可以同时执行。
- 切换会话不会停止其他正在运行的会话。
- 同一个会话内，用户发送的新消息仍然排队串行。
- 同一个 tab 上的多个网页任务自动排队。
- 不同 tab 上的网页任务可以并行执行。
- D 仔可以根据任务依赖和资源冲突判断哪些子任务适合并行。
- 当前侧栏关闭行为保持不变：关闭侧栏时终止所有 AI 会话和网页子任务。
- 关闭侧栏时尽力提示用户，但不能依赖浏览器原生关闭确认完成清理。
- 保留已持久化的历史消息和任务记录。
- 第一阶段不支持关闭侧栏后继续执行。
- 第一阶段不新增 AI 运行持久化表，除非实现过程中确认当前架构无法满足需求。

## 2. 当前实现和限制

### 2.1 AI 会话目前是全局串行

以下状态都是全局单例：

- `status`
- `error`
- `AbortController`
- 流式 assistant 内容累积器
- reasoning 内容
- 待确认工具
- 待确认构建
- continuation
- 当前消息数组

重点文件：

- `src/features/aiAssistant/hooks/useAIChatState.ts`
- `src/features/aiAssistant/hooks/useAIChatMessages.ts`
- `src/features/aiAssistant/hooks/useAIChatRuntime.ts`
- `src/features/aiAssistant/hooks/useAIChatToolFlow.ts`
- `src/features/aiAssistant/hooks/useAIChatActions.ts`
- `src/features/aiAssistant/hooks/useAIChatFacade.ts`

当前切换会话时会调用 `stopRuntime`，因此切换必然终止当前任务。

### 2.2 当前网页任务已经支持全局排队

`src/entrypoints/background/handlers/browserTask.ts` 当前使用：

```ts
activeTask;
queuedTasks;
```

它已经可以做到：

- 同一时间只执行一个网页任务。
- 后续任务进入队列。
- 任务完成后自动启动下一个。
- 排队任务可以被停止。

但当前缺点是：

- 不同 tab 的任务也会互相排队。
- 所有网页任务共用一个全局 `activeTask`。
- `delegate_browser_agent` 只能使用当前活动 tab。
- D 仔无法选择不同 tab，因此无法实际发起不同 tab 的并行任务。
- 当前提示词明确要求每次只委派一个任务并等待返回，这会阻止并行。

### 2.3 当前侧栏关闭清理不完整

`src/entrypoints/sidepanel/App.tsx` 建立了：

```ts
browser.runtime.connect({ name: BROWSER_TASK_HOST_PORT_NAME });
```

但后台目前只记录和移除 port，没有在最后一个 port 断开时停止网页任务。

因此需要补充关闭清理，否则侧栏销毁后后台网页 Agent 可能继续运行。

## 3. 设计边界

### 3.1 不支持同一会话内用户消息并行

同一会话仍然保持线性上下文：

```text
消息 A
  -> assistant A
  -> tool A
  -> assistant continuation A
  -> 消息 B
```

如果当前会话正在运行，用户发送的新消息继续进入该会话的队列。

不要把同一会话的用户消息改成多个并行请求，否则会产生：

- 上下文顺序不确定。
- 工具结果归属不明确。
- assistant 输出相互覆盖。
- 同一会话的数据库消息顺序不稳定。

### 3.2 不同会话可以同时运行

会话 A 和会话 B 各自拥有独立的：

- AbortController
- AI provider 请求
- 流式累积器
- assistant 消息 ID
- reasoning
- 工具执行状态
- 待确认状态
- 错误状态
- 当前运行状态

### 3.3 关闭侧栏终止所有运行

第一阶段不要求后台继续执行。

关闭侧栏时：

- 停止所有会话级 AI 请求。
- 停止所有网页任务。
- 清空网页任务队列。
- 保留历史消息。
- 保留已写入的任务终态记录。

## 4. 会话运行上下文

新增一个按 `sessionId` 管理的运行上下文。可以放在新的轻量模块中，也可以先放在 `useAIChatFacade` 管理，但必须避免继续扩大全局 hook 状态。

建议结构：

```ts
interface SessionExecution {
  sessionId: string;
  runId: string;
  status: AIChatStatus;
  error: string | null;
  abortController: AbortController;
  messages: ChatMessage[];
  assistantMessageId?: string;
  reasoning: string;
  pendingToolCalls: PendingToolCalls | null;
  pendingBuild: PendingBuild | null;
  cancelled: boolean;
}
```

由以下结构管理：

```ts
Map<string, SessionExecution>;
```

注意事项：

- `runId` 每次新的用户请求生成一个唯一值。
- 所有异步回调必须携带或闭包捕获明确的 `sessionId/runId`。
- 不允许异步回调读取当前选中会话来决定写入哪个消息。
- 不允许继续通过“最后一条 assistant 消息”定位流式输出。
- 应通过 `assistantMessageId` 精确更新消息。
- `AbortController.abort()` 必须只影响对应 run。
- 切换会话只切换 UI 当前 session，不调用其他 session 的停止逻辑。

## 5. 消息状态改造

当前 `useAIChatMessages` 的以下逻辑必须改造：

```ts
const lastMsg = prev[prev.length - 1];
```

流式 chunk 不能再追加到最后一条 assistant。

建议按会话保存消息：

```ts
Map<string, ChatMessage[]>;
```

每个运行上下文记录：

```ts
assistantMessageId;
```

收到 chunk 时：

1. 找到对应 `sessionId`。
2. 找到对应 `assistantMessageId`。
3. 只更新这条消息。
4. 触发当前选中会话的 UI 更新。
5. 非当前会话只更新内存状态，不影响当前界面内容。

切换会话时：

1. 从 Dexie 加载持久化消息。
2. 查找该 session 是否有正在运行的内存上下文。
3. 如果有，将运行中的消息状态合并到加载结果。
4. 将该 session 设置为当前显示会话。

第一阶段可以只在内存中保存流式中间状态，assistant 最终结果仍按当前逻辑持久化。

## 6. Runtime 改造

重点文件：

`src/features/aiAssistant/hooks/useAIChatRuntime.ts`

当前以下 ref 只能存在于单个 run：

```ts
abortControllerRef;
accumulatedContentRef;
accumulatedReasoningRef;
hasStreamedChunkRef;
```

建议将 runtime 接口改成接收明确的 session 参数：

```ts
runChatCompletion(
  sessionId: string,
  apiMessages: ProviderChatMessage[]
): Promise<ChatMessage>
```

或者由 `SessionExecution` 对象承载这些状态。

要求：

- 每次调用创建独立 `AbortController`。
- provider 请求的 callbacks 只回写该 run。
- `onStreamStart`、`onStreamChunk`、`onReasoningChunk` 都携带 session/run 标识。
- `stopRuntime(sessionId)` 只停止该 session。
- `resetRuntimeState(sessionId)` 只重置该 session。
- 不要因为当前 UI 切换到其他 session 而取消后台 session。

## 7. Tool Flow 改造

重点文件：

- `useAIChatToolFlow.ts`
- `useAIChatToolFlowExecution.ts`
- `useAIChatBuildFlow.ts`
- `executeToolCalls.ts`

以下状态必须按 session/run 隔离：

- `pendingToolCalls`
- `pendingBuild`
- `executionCancelled`
- continuation
- build completion state

确认操作规则：

- `confirmToolCall` 只确认当前选中会话的工具。
- `confirmAllToolCalls` 只处理当前选中会话。
- 切换会话后，确认弹窗应显示新会话的待确认内容。
- 停止某个会话不能取消其他会话的工具执行。
- 编辑、清空、删除某会话前，只停止并清理目标会话。

当前 `completeBuild` 和 `cancelBuild` 依赖全局 `pendingBuild`，必须改为操作指定 session 的 build 状态。

## 8. 子任务并行判定

不要把所有工具调用直接改成：

```ts
await Promise.all(toolCalls);
```

需要有安全的并行边界。

建议给 `AIToolMetadata` 增加可选执行信息：

```ts
execution?: {
  mode: 'parallel' | 'serial';
  getResources?: (args: Record<string, unknown>) => string[];
}
```

默认规则：

- 没有 `execution` 声明的工具默认为 `serial`。
- `mode: 'serial'` 的工具永远串行。
- 相同资源存在写操作时串行。
- 不同资源且明确允许并行时可以并行。
- 高副作用工具默认串行。
- 不能仅依赖模型判断，因为模型无法完整知道本地工具的共享资源。

资源键示例：

```text
link:123
tag:frontend
session:abc
browser-tab:101
settings:ai
jenkins:job-url
```

并行批次算法：

1. 解析 tool calls。
2. 规范化工具名称和参数。
3. 分离必须确认的工具。
4. 查询工具执行模式。
5. 为每个工具生成资源键。
6. 根据资源冲突划分执行批次。
7. 批次内部使用 `Promise.allSettled`。
8. 按原始 tool call 顺序生成 tool messages。
9. 将失败结果作为对应 tool 的错误结果返回给 D 仔。
10. 一个独立任务失败时，不自动取消其他无冲突任务。

第一阶段建议只开放：

```text
delegate_browser_agent
```

的并行调度。

其他 DPP 工具先保持串行，等工具资源模型验证后再逐步开放。

### 8.1 构建工具注意事项

当前 `executePreparedToolCalls` 遇到 `open_build_dialog` 会提前返回，并保留剩余工具调用。

并行化时必须保留这个行为。

保守方案：

- 只要一个批次包含 `open_build_dialog`，该批次整体串行。
- 构建确认前不要启动后续有副作用的工具。
- 已经完成的独立只读任务可以保留结果。
- `remainingToolCalls` 必须保持原始顺序。
- 构建取消时，剩余工具调用不能被误执行。

### 8.2 工具确认注意事项

当前非 YOLO 模式下，多个确认工具会进入一个 `pendingToolCalls`。

要求：

- “确认全部”可以让其中允许并行的网页任务进入并行调度。
- “逐个确认”保持串行。
- 用户取消一个高风险工具时，不应自动取消其他已经明确确认且无依赖的任务，除非它们共享资源。
- 确认 UI 必须显示每个工具的任务范围和目标 tab。

## 9. 网页任务调度

重点文件：

- `src/lib/ai/tools/browserTask.ts`
- `src/entrypoints/background/handlers/browserTask.ts`
- `src/lib/browserTask/types.ts`
- `src/lib/db/browserTasks.ts`

当前全局结构：

```ts
activeTask;
queuedTasks;
```

改为按 tab 管理：

```ts
Map<number, BrowserTaskExecution>;
Map<number, BrowserTaskStartMessage[]>;
```

建议任务上下文：

```ts
interface BrowserTaskExecution {
  taskId: string;
  sessionId?: string;
  toolCallId?: string;
  initialTabId: number;
  controller: AbortController;
  done: Promise<void>;
}
```

调度规则：

- 同一个 `initialTabId` 同时只运行一个任务。
- 同一个 tab 的后续任务进入该 tab 队列。
- 不同 tab 的任务可以同时执行。
- 每个任务使用独立的 `MultiPageAgent`。
- 每个任务使用独立的 `TabsController`。
- 每个任务使用独立的 `AbortController`。
- 建议增加全局最大网页任务并发数。
- 任务数超过全局上限时进入等待队列。
- 同 tab 队列优先按提交顺序执行。

注意：

`MultiPageAgent` 可以打开和切换任务内部的 tab。第一版应把任务的 `initialTabId` 作为资源锁持有到任务结束，即使 Agent 后续打开了新 tab，也不要提前释放初始 tab 锁。

这样可以避免两个任务同时操作同一个起始页面。

## 10. D 仔选择目标 tab

当前 `delegate_browser_agent` 只有 `task` 参数，这是实现不同 tab 并行的关键缺口。

需要增加只读工具：

```text
list_browser_tabs
```

返回：

```ts
{
  tabId: number;
  title: string;
  url: string;
}
```

注意事项：

- 只返回 HTTP(S) 且可注入的页面。
- 不返回扩展页、设置页等不可操作页面。
- URL 可能包含敏感信息，必须按现有敏感数据规则处理日志。
- 该工具本身是只读工具，可以标记为可并行。
- D 仔先调用该工具获取 tab 列表，再决定任务分配。

`delegate_browser_agent` 增加：

```ts
tab_id?: number
```

行为：

- 指定 `tab_id` 时使用指定 tab。
- 未指定时使用当前活动 tab。
- 指定 tab 不存在或不可操作时立即返回错误。
- 任务的 `initialTabId` 写入后台任务记录。
- 任务进度继续通过 `sessionId` 和 `toolCallId` 关联。

## 11. 网页任务提示词修改

重点文件：

`src/lib/ai/promptBrowserTask.ts`

删除或改写当前“每次只委派一个任务，等待返回后再继续”的强制串行描述。

新规则应包含：

- 独立且无依赖的任务可以同时委派。
- 依赖前一任务结果的任务必须等待。
- 相同 tab 的任务交给调度器排队。
- 不同 tab 的独立任务可以并行。
- 相同页面、账号、订单、资源或外部状态的写操作必须串行。
- 不要因为任务并行就扩大任务范围。
- 每个网页子 Agent 只处理一个边界明确的子任务。
- 并行任务全部返回后，再综合结果。
- 只根据实际返回结果判断任务是否完成。

提示词只负责引导，程序调度器负责最终安全控制。

## 12. UI 改造

重点文件：

- `AIAssistantView.tsx`
- `AIAssistantHeader.tsx`
- `AISessionList.tsx`
- `AIAssistantInputSection.tsx`
- `ToolConfirmationDialog.tsx`

需要修改：

- 不再因为当前 session 运行而禁用会话切换。
- 不再因为当前 session 运行而禁用新建会话。
- 会话列表显示每个 session 的运行状态。
- 当前 session 的输入框继续支持停止。
- 其他 session 只显示运行状态，不允许从当前输入区误停止。
- 顶部状态只表示当前选中会话。
- 切换到等待确认的 session 时显示该 session 的确认弹窗。
- 网页任务进度按当前 session 过滤。
- 对后台 session 运行完成提供状态提示或会话列表标记。
- 多个网页任务同时运行时，进度项必须通过 `toolCallId` 准确归属。

当前 `AIAssistantHeader` 中的：

```tsx
disabled = { isRunning };
```

需要改为只在真正不可操作的情况下禁用，不能阻止会话切换和新建。

## 13. 关闭侧栏清理

重点文件：

- `src/entrypoints/sidepanel/App.tsx`
- `src/entrypoints/background.ts`
- `src/entrypoints/background/handlers/browserTask.ts`
- AI 会话运行管理模块

### 13.1 React 侧

在 AI 运行管理器卸载时：

- 同步 abort 所有 session run。
- 清理当前页面内存中的 continuation。
- 清空本地排队消息。
- 不删除数据库历史消息。

不要依赖异步 `stopActiveBrowserTask` 在页面销毁前完成。

### 13.2 Background port 侧

当前 `App.tsx` 建立了 `BROWSER_TASK_HOST` port，后台维护了 port 集合。

需要在最后一个 port 断开时：

- 停止所有 active browser tasks。
- 停止所有 queued browser tasks。
- 将任务状态写成 `stopped`。
- 设置停止来源为 `system`，或者新增明确的 `sidepanel` 来源。
- 向仍存在的监听器发送任务终态事件。

只有最后一个 sidepanel port 断开时才执行，避免多个 sidepanel 连接互相误停。

### 13.3 用户提示

可以增加：

```ts
window.addEventListener('beforeunload', ...)
```

当存在任意运行中 session 或网页任务时触发浏览器原生确认。

注意：

- 浏览器通常只允许通用提示文本。
- 不保证能显示自定义中文文案。
- sidepanel 关闭操作不一定允许扩展阻止。
- `beforeunload` 只能作为尽力提示。
- port disconnect 清理才是实际终止机制。

如果需要完全可控的提示，应提供应用内“关闭 D 仔”按钮。浏览器自带侧栏关闭按钮不能被扩展完全接管。

## 14. 数据库注意事项

第一阶段不修改 Dexie schema。

保留现有：

- `aiSessions`
- `aiMessages`
- `browserTasks`
- `aiPlans`

不要为了保存内存中的运行状态立即新增 `aiRuns` 表。

只有在后续要求以下能力时才增加数据库版本：

- 关闭侧栏后继续运行。
- 扩展重启后恢复任务。
- 多个 sidepanel 实例共享运行状态。
- 后台任务在 service worker 重启后恢复。

如果确实需要新增运行表，必须：

- 新增 Dexie 版本。
- 编写迁移逻辑。
- 记录 `runId/sessionId/status/updatedAt`。
- 不持久化 `AbortController` 等运行时对象。
- 明确中断任务是停止、重试还是恢复。
- 评估工具幂等性，避免恢复时重复执行写操作。

## 15. 测试计划

新增或扩展测试，至少覆盖：

### 会话并行

- 会话 A 和 B 同时执行。
- A、B 的流式 chunk 交错到达时互不覆盖。
- 切换到 B 不会停止 A。
- 停止 B 不会影响 A。
- A 在后台完成后切回 A 可以看到完整内容。
- A 等待工具确认时，B 可以继续执行。
- 删除 A 不影响 B。
- 清空 A 不影响 B。
- 编辑 A 只停止和重建 A。

### 同会话串行

- 同一 session 运行时发送第二条消息会排队。
- 第二条消息不会创建独立 AI run。
- 第一轮完成后第二条消息按原上下文执行。
- 停止会话时队列被清空。

### 工具并行

- 两个明确无冲突的网页工具调用可以同时执行。
- 同资源工具调用被拆分到不同批次。
- 未声明资源的工具保持串行。
- 一个并行任务失败不影响其他任务。
- tool message 仍按原始调用顺序返回。
- 构建工具仍然正确暂停并保留剩余调用。
- 取消确认后不会错误执行剩余高风险操作。

### 网页任务调度

- 同 tab 两个任务按顺序执行。
- 不同 tab 两个任务同时执行。
- 同 tab 队列中的任务可以单独取消。
- 取消某 session 不会影响其他 session 的网页任务。
- 关闭侧栏会停止 active 和 queued 任务。
- 任务状态最终写入 `stopped`。
- `toolCallId` 和 `sessionId` 关联正确。
- 指定不存在的 `tab_id` 返回明确错误。
- 当前活动 tab 未指定时仍保持兼容行为。

### 关闭侧栏

- 有运行任务时触发 `beforeunload`。
- 用户取消浏览器关闭提示时，任务继续。
- 最后一个 sidepanel port 断开时后台停止任务。
- 多个 port 存在时，单个 port 断开不停止任务。
- 无运行任务时不触发提示。

## 16. 实现期间必须遵守的注意事项

- 不要撤销工作区中已有的用户修改。
- 当前工作区有大量未提交变更，修改前先确认 `git status`，只改本任务涉及的文件。
- 不要直接改动与本功能无关的迁移、browser agent 删除或 vendor 文件。
- 不要新增 `any`。
- 不要使用 `@ts-ignore` 或 `@ts-expect-error`。
- 不要改变已有数据库版本，除非确实新增 schema。
- 不要把同一会话用户消息改成并行。
- 不要把所有工具无条件改成 `Promise.all`。
- 不要把不同 tab 的并行能力误认为同一个 tab 可以并行。
- 不要依赖模型提示词作为唯一安全控制。
- 不要依赖 `beforeunload` 完成任务清理。
- 不要在后台任务停止时删除历史消息。
- 不要让异步回调通过当前选中 session 决定写入目标。
- 每个流式输出必须通过固定的 `sessionId/runId/assistantMessageId` 定位。

## 17. 验收标准

满足以下条件后才能认为第一阶段完成：

- 两个不同 session 可以同时请求 AI provider。
- 切换 session 不会中断后台 session。
- 同一 session 仍按消息顺序串行。
- 同一个 tab 的网页任务严格排队。
- 不同 tab 的网页任务确实同时执行。
- D 仔能够获取 tab 列表并指定目标 tab。
- 独立网页任务可以在同一轮并行委派。
- 有资源冲突的任务会自动降级为串行。
- 工具结果、浏览器进度和确认状态不会跨 session 串线。
- 关闭侧栏时所有 AI run 和网页任务都会终止。
- 关闭侧栏时尽力显示浏览器原生提示。
- 历史消息和任务记录不会丢失。
- `pnpm compile` 通过。
- `pnpm lint:fix` 后无新增 lint 错误。
- `pnpm build` 通过。
- 相关并发场景测试通过。

## 18. 推荐验证命令

```bash
pnpm compile
pnpm lint:fix
pnpm build
pnpm test
```

实施前应再次检查：

```bash
git status --short
```

当前计划的最小实现顺序是：

```text
按 session 隔离 AI runtime
-> 按 session 隔离消息和工具流
-> 按 tab 调度网页任务
-> 增加 tab 列表和 tab_id
-> 开放网页任务并行
-> 增加侧栏关闭清理和提示
-> 测试和构建验证
```
