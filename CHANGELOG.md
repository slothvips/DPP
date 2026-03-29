# 更新日志

## v0.4.0 (2026-03-29)

### ✨ 新功能

- **YOLO 模式按钮**: 新增 AI 助手界面的 YOLO 模式开关
  - 一键开启自动确认所有工具调用，无需逐个点击确认
  - 包含安全警告提示，建议仅在安全场景使用
  - 支持实时状态同步，跨组件状态一致

- **工具箱增强**: 全面优化 Toolbox 各工具组件
  - Monaco Editor Worker 配置优化，确保编辑器正确初始化
  - DataDiffTool 改进数据差异对比体验
  - TimestampTool 时间戳转换功能增强
  - DiffTool/JsonTool 代码优化，提升稳定性

### 🔧 依赖更新

- **page-agent 升级**: 从 1.6.1 升级到 1.6.2

### 🏗️ 构建优化

- **Rollup 配置**: 添加 eval 警告过滤，消除 page-agent 依赖的构建警告
- **Monaco Worker**: 新增独立 worker 配置文件 `src/lib/monaco/worker.ts`

### 🔧 代码质量

- **Logger 优化**: 增强日志工具功能
- **AI Assistant UI**: 简化 TabSelector 组件

---

## v0.3.9 (2026-03-24)

### ✨ 新功能

- **树形数据对比工具**: 新增独立页面，支持树形/扁平数据的差异对比
  - 自动检测 id、name、pid、children 等关键字段
  - 支持新增、删除、更新三种差异类型展示
  - 点击更新节点可查看具体变更详情
  - 仅显示差异筛选功能

### 🎨 界面优化

- **Tab 标签更名**: "热点" 更名为 "资讯"，"AI助手" 更名为 "D仔"
- **AI 设置对话框优化**: 标题更新为"给 D仔 接入外置大脑🧠"，移除冗余描述文字

---

## v0.3.8 (2026-03-22)

### ✨ 新功能

- **PageAgent 独立控制**: 新增关闭所有 PageAgent 实例功能，侧边栏关闭时自动清理所有活跃实例
- **PageAgent 工具超时机制**: 为 pageagent_execute_task 工具添加 60 秒超时，避免 background 无响应时永久等待
- **YOLO 按钮动画**: 为 AI 助手界面的 YOLO 模式按钮添加边框高亮动画效果

### 🏗️ 架构优化

- **Content Script 优化**: 移除 content script 的自动注入配置 (`matches: []`)，改为完全由 background 编程式注入
- **PageAgent 生命周期管理**: 新增 `injectedTabs` 追踪机制，监听标签页关闭自动清理注入记录
- **PlayerApp 播放控制改进**: 添加 seekTimeRef 追踪播放位置，支持从上次位置继续播放
- **PlayerApp 缩放优化**: 简化初始加载和侧边栏切换时的缩放更新逻辑

### 🔧 代码质量

- **完全移除 WebLLM**: 从代码库中完全移除 WebLLM 相关代码（provider、types、UI 配置），简化 AI 提供商选择
- **自动化测试按钮移除**: 从 AI 助手快捷指令中移除不再使用的自动化测试按钮
- **Prompt 精简**: 移除 Agent Control Tools 相关描述，保持 prompt 简洁准确
- **移除本地模型警告**: 移除"本地模型体验不佳"的提示 UI

---

## v0.3.7 (2026-03-21)

### ✨ 新功能

- **工具箱 (Toolbox)**: 新增实用工具集，支持多种常用功能
  - **Diff 对比工具**: 基于 Monaco Editor 的文本差异对比，支持 side-by-side 显示、AI 智能解读差异内容
  - **正则表达式工具**: 支持常用正则预设（URL、HTML标签、邮箱、手机号等）、实时匹配高亮、ReDoS 防护
  - **时间戳工具**: 支持时间戳/日期字符串互转、时区转换、AI 智能解析模糊时间表达

### 🏗️ 架构优化

- **Tab Keep-alive 模式**: 所有 Tab 组件使用 Vue-like keep-alive 模式，保持挂载状态避免重复渲染
- **平滑切换动画**: Tab 切换添加 opacity 过渡效果，消除闪烁
- **独立 Diff 页面**: 新增 `diff/index.html` 独立页面入口，可单独打开使用
- **JenkinsIcon 组件**: 新增 Jenkins 图标组件

### 🔒 安全与稳定性

- **SyncEngine 重复注册防护**: 防止同步引擎重复注册 hooks 导致的问题
- **localStorage 安全访问**: 添加安全检查避免 SSR/Worker 环境报错
- **ReDoS 防护**: 正则表达式工具简化预设模式，避免恶意输入导致的正则爆炸
- **内存泄漏修复**: 修复 BlackboardItem 等组件中的 setTimeout 未清理问题

### 🔧 代码质量

- **PlayerApp 重构**: 移除多个 setTimeout，使用重试计数器机制替代，提升可靠性
- **DiffView 错误边界**: Monaco Editor 添加错误边界处理，初始化失败时显示友好提示
- **ConsolePanel 优化**: 提取魔法数字为常量，添加 ESLint 规则说明注释

---

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
