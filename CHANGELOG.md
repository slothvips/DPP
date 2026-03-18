# 更新日志

## v0.3.6 (2026-03-18)

### ✨ 新功能

- **链接排序持久化**: 链接列表的排序方式（按添加时间/更新时间/使用次数/上次使用）现在会持久化保存，刷新页面后保持不变

### 🔒 安全与稳定性

- **同步 Token 修复**: 修复 `getSyncAccessToken()` 在未配置时返回 undefined 的问题，现在正确返回空字符串
- **PageAgent 网络请求**: 移除对 localhost 和私有网络请求的验证，确保 PageAgent 可以正常访问内部开发服务

### 💬 AI 助手改进

- **工具执行确认优化**: AI 助手的所有增删改操作现在都需要用户确认，防止意外操作
  - 新增确认工具: links_add, links_update, links_togglePin, links_bulkAdd, tags_add, tags_update, tags_toggle, jenkins_trigger_build, jenkins_sync, blackboard_add, blackboard_update, recorder_delete, recorder_clear, recorder_import, sync_trigger
- **Prompt 精简优化**: 精简 AI 系统提示词，从 295 行优化到 145 行，结构更清晰准确
- **Prompt 行为一致**: 修复提示词描述与实际行为不一致的问题

### 🏗️ 架构优化

- **Background 消息路由重构**: 将 background.ts 中的消息处理逻辑重构为策略模式，提升代码可维护性
- **通用消息处理器**: 新增 `general.ts` 统一处理 PAGE_AGENT 和 Jenkins Token 等通用消息
- **Base64 工具模块**: 提取 base64 编解码工具函数到独立模块 `src/utils/base64.ts`
- **数据库迁移文档**: 完善数据库增量迁移注释，明确版本历史和迁移规则
- **同步 URL 提取**: 提取 `getSyncServerUrl()` 和 `getSyncAccessToken()` 辅助函数，减少重复代码

---

## v0.3.5 (2026-03-12)

### ⚡ 性能优化

- **标签更新批量操作**: `updateLink` 函数使用批量操作替代逐条处理，提升大量标签更新场景的性能
- **useAIChat ref 优化**: 移除不必要的 useEffect，直接在函数定义后更新 ref，减少重渲染

### 🏗️ 架构优化

- **类型定义改进**: 优化 `zentao.content.tsx` 和 `recorder.ts` 中的类型定义，提升类型安全

---

## v0.3.4 (2026-03-09)

### ✨ 新功能

- **黑板锁定功能**: 添加锁定机制，防止意外编辑，保护重要内容
- **AI 会话压缩**: 新增会话压缩功能，优化长会话的存储和加载性能
- **滚动到底部按钮**: AI 聊天界面添加滚动到底部浮窗按钮，快速查看最新消息
- **工具调用改进**: 优化 AI 工具调用处理逻辑，添加分页支持
- **DEV 模式指示器**: 扩展在开发模式下显示明显标识，便于区分开发和生产环境
- **虚拟列表组件**: 引入 @tanstack/react-virtual，高效渲染大量数据列表
- **远程操作归档**: 添加远程操作归档功能，管理和清理历史同步操作

### 🏗️ 架构优化

- **数据库操作统一封装**: 所有数据库操作统一到 lib/db 封装层
  - settings 操作封装到 `src/lib/db/settings.ts`
  - Jenkins 操作封装到 `src/lib/db/jenkins.ts`
  - tags 操作封装到 `src/lib/db/tags.ts`
  - 统一使用软删除模式处理 linkTags，与 tags 行为保持一致

### 🐛 修复

- **同步状态显示修复**: 修复同步成功后仍显示失败状态的问题
- **录音状态清理**: 添加录音状态过期清理机制，防止内存泄漏
- **时间冲突解决**: 使用本地 timestamp 进行 LWW (Last Write Wins) 冲突解决

---

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
