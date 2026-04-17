# CLAUDE.md

## 语言要求

- 所有对话使用中文。
- 所有文档使用中文。
- 所有代码注释使用中文。

## 执行要求

- 在生成说明、总结、计划、提交说明时，统一使用中文。
- 在新增或修改 Markdown 文档时，统一使用中文。
- 在新增或修改代码注释时，统一使用中文。

## 协作演进原则

- 默认假设模型能力处于持续提升的动态上限中；能直接依赖模型完成的高置信工作，不要继续用过细指令重复约束。
- Prompt / 约束的目标是提供护栏，不是替代思考；仅在真实存在风险、歧义、跨上下文耦合或历史上反复出错的场景增加约束。
- 定期审视现有约束；若某条规则只是为了弥补旧模型能力、某个短期阶段、或一次性问题，应在不再需要时删除或收缩。
- 区分“长期稳定判断标准”和“阶段性经验”：前者保留在此文档，后者优先放在对应任务、计划、技能或临时说明中，不要无限堆积为永久规则。
- 当对话中反复出现高价值、可复用、步骤相对稳定的流程时，优先沉淀为 skill、模板、检查清单或流程文档，而不是每次重新手写 prompt。
- 若已有 skill 或沉淀流程可以覆盖当前任务，优先复用并在使用后继续迭代；沉淀的目标是减少重复沟通成本，而不是增加新的流程负担。

## Commands

- 仅使用 `pnpm`，并在仓库根目录执行。
- 开发：`pnpm dev`、`pnpm dev:firefox`、`pnpm watch:build`
- 构建：`pnpm build`、`pnpm build:firefox`、`pnpm zip`、`pnpm zip:firefox`
- 质量：`pnpm compile`、`pnpm lint`、`pnpm lint:fix`、`pnpm format`
- 当前无正式 test script；验证以 `pnpm compile`、`pnpm lint`、`pnpm build`、手动 / Chrome DevTools MCP 测试为主。
- 交互 UI 的 `data-testid` 必须保持稳定。
- pre-commit 会运行 `pnpm lint-staged`；staged `*.{js,jsx,ts,tsx}` 会自动执行 `eslint --fix` 与 `prettier --write`。

## Core constraints

- 这是 sidepanel-first 扩展；不要按 popup-first 假设实现。
- 必须兼容 light / dark / system 主题。
- 文本对比度目标为 WCAG AA。
- 不要破坏现有数据行为或 sync 行为。
- 优先修改现有链路，不要新增平行实现。

## Architecture constraints

- 主应用壳：`src/entrypoints/sidepanel/App.tsx`
- background 入口：`src/entrypoints/background.ts`
- 新增 background-backed 功能时，必须走 `src/entrypoints/background/handlers/index.ts` 现有 handler 模式，不要往 `background.ts` 塞临时逻辑。
- Dexie `src/db/index.ts` 是共享状态核心。
- 业务数据访问优先复用 `src/lib/db/*`，不要重复直接操作表。
- Sync 是 selected-table sync，不是全库同步。
- UI 响应式读取默认使用 `useLiveQuery`。
- 新增会修改数据的 AI tool 时，若现有 AI flow 未处理确认，必须要求确认。

## Sync and data rules

- 冲突策略是 LWW。
- 冲突比较必须使用本地客户端时间戳（`updatedAt` / operation timestamp），不能改为服务端时间戳。
- Sync 依赖 Dexie lifecycle hooks；绕过 Dexie CRUD 会导致 sync hook 不触发。
- 来自 sync 的操作必须保持 `tx.source === 'sync'`，避免反馈回路。
- synced entity 删除必须走软删除 `deletedAt`，不要单点改成硬删除。
- synced 且加密：`tags`、`jobTags`、`links`、`linkTags`、`blackboard`
- 仅本地：Jenkins credentials、build history、绝大多数 settings、recordings、local stats / caches

## Coupled changes

- 改 schema / shared entity 字段时，至少联查：`src/db/types.ts`、`src/db/index.ts`、相关 `src/lib/db/*`、相关 UI / hooks；若该表参与 sync，再查 `src/lib/sync/SyncEngine.ts`。
- 改 sync 行为时，联查：`src/lib/sync/types.ts`、`src/lib/sync/SyncEngine.ts`、`src/db/index.ts`、相关 `src/lib/db/*`。
- 改 AI tools 时，联查：`src/lib/ai/tools.ts`、`src/lib/ai/index.ts`、具体 `src/lib/ai/tools/*.ts`、复用到的 `src/lib/db/*` 或 background handlers。
- 改 PageAgent 时，联查：`src/lib/ai/tools/pageAgent.ts`、`src/entrypoints/background/handlers/pageAgent.ts`、`src/lib/pageAgent/injector.ts`、`src/entrypoints/pageAgent.content.ts`、`src/entrypoints/background/handlers/general.ts`、`wxt.config.ts`。
- 改 Recorder 时，联查：`src/features/recorder/*`、`src/entrypoints/background/handlers/recorder.ts`、`src/entrypoints/recorder.content.ts`、`src/entrypoints/network-interceptor.ts`、`src/entrypoints/console-interceptor.ts`、player 相关 entrypoints 与 recorder storage。
- 改 feature tab / toggle 时，联查：`src/entrypoints/sidepanel/App.tsx`、options/settings UI、settings types in DB layer。

## Coding constraints

- 使用 `@/` alias，不用 parent-relative imports。
- 禁止 `any`。
- 禁止 `@ts-ignore` 与 `@ts-expect-error`。
- React 组件优先使用 `function Component() {}`。
- 不要留下 floating promises；要么 `await`，要么显式 `void`。
- async UI action 在需要日志或用户反馈时必须包 `try/catch`。
- 诊断使用 `logger`；用户可见错误优先复用现有 toast 模式。
- 优先复用 `src/components/ui/*` primitives。
- 改动保持在现有 feature 结构内，不要引入一次性抽象。

## UI and accessibility constraints

- 暗色模式下，不要给 `muted-foreground` 叠加 opacity modifier。
- 不要使用 `text-muted-foreground/70`、`text-muted-foreground/50`、`dark:text-muted-foreground/60`。
- 直接使用基础 token，保证可读性与对比度。

## WXT / manifest constraints

- `wxt.config.ts` 必须保持移除 `action.default_popup`，点击扩展按钮应打开 side panel。
- 依赖权限包括：`storage`、`sidePanel`、`alarms`、`activeTab`、`scripting`、`tabs`。
- 若移动或重命名 recorder / PageAgent 相关资源，必须同步更新 `wxt.config.ts` 的 `web_accessible_resources`。

## Editing checklist

- 先读对应 feature entrypoint 与共享数据 helpers。
- 先确认行为落在 background messages、shared DB helpers，还是两者都有。
- 只要改动涉及 sync、recording、PageAgent，就按跨上下文链路处理。
- 优先改现有流程，不要新增平行抽象。
