# 更新日志

## v0.3.3 (2026-03-08)

### ⚡ 性能优化

- **AI 会话输入性能优化**: 创建独立的 ChatInput 组件和 MessageItem 组件，使用 React.memo 和自定义比较函数，解决消息多时输入卡顿问题
- **listLinks N+1 查询优化**: 改用批量加载所有数据，使用 Map 查找，从 O(n) 次查询降到 O(1) 次
- **JenkinsView 查询合并**: 将多个 useLiveQuery 合并为单一查询，减少重渲染次数
- **页面可见性检测**: Jenkins 轮询在页面后台时自动暂停，节省资源

### 🏗️ 架构优化

- **background.ts 模块化拆分**: 将 685 行的单一文件拆分为 7 个 handler 模块 (jenkins, recorder, sync, omnibox, proxy, remoteRecording, index)
- **解耦循环依赖**: SyncEngine 直接使用 db 而非 lib/db，避免循环依赖
- **统一远程活动日志操作**: 使用 addRemoteActivities 封装层，代码更简洁

### 🐛 修复

- **useAIChat useEffect 依赖修复**: 添加正确的依赖数组，确保 refs 在依赖变化时同步
- **统一日志系统**: 将 console.log/warn/error 统一替换为 logger 工具
- **添加错误处理**: 为 SyncEngine queueMicrotask 中的异步操作添加 try-catch

### 🔧 代码质量

- 移除未使用的导入，消除 ESLint 警告
- 完善 AGENTS.md 开发指南文档

---

## v0.3.0 (2026-03-05)

### ✨ 新功能

- 新增更新日志页面，可从远程 Markdown 加载内容显示
- 设置页面添加更新日志入口

### 🐛 修复

- 修复自动同步设置检查逻辑

### 🔧 改进

- 数据库抽象层优化，统一settings操作
- Jenkins 认证方式改为 Unicode 安全的 createJenkinsClient

---

## v0.2.0 (2026-02-01)

### ✨ 新功能

- 添加 AI 助手功能
- 支持多种 AI 提供商 (Ollama, WebLLM, OpenAI, Anthropic)

### 🎨 优化

- UI 组件重构
- 暗色模式优化
