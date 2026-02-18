# PRD: AI 助手功能

## Introduction

为浏览器扩展新增 AI 助手功能，用户可以通过自然语言指令调用工具完成以下任务：管理链接（增删改查、标签管理）、管理 Jenkins Jobs（查看状态、触发构建）、管理录屏（开始/停止录制、查看列表）、管理便签（增删改查）、获取今日热榜、管理标签、触发全局同步。

该功能旨在让用户通过自然语言更高效地管理浏览器扩展的各种功能，降低操作复杂度，提升用户体验。

## Goals

- 用户可以通过自然语言指令完成链接、Jenkins、便签等功能的增删改查操作
- 提供统一的工具定义格式，兼容多种模型（Ollama、OpenAI 等）
- 危险操作（删除、触发构建）通过应用层弹窗确认，保障数据安全
- 查询类操作直接执行，无需用户确认，提升效率
- 所有用户默认可以使用 AI 助手功能

## User Stories

### US-001: AI 助手 Tab 入口
**Description:** 作为用户，我想在 Popup 中看到 AI 助手入口，以便快速进入 AI 对话界面。

**Acceptance Criteria:**
- [ ] 在 Popup 的 Tab 导航栏中添加 "AI 助手" 选项
- [ ] 点击 Tab 切换到 AI 助手视图
- [ ] Tab 名称为"AI 助手"或类似描述性名称
- [ ] Typecheck passes

### US-002: AI 配置页面
**Description:** 作为用户，我想配置 AI 模型服务地址和模型名称，以便使用 AI 助手功能。

**Acceptance Criteria:**
- [ ] 在 AI 助手视图中显示配置入口（如设置图标或"配置"按钮）
- [ ] 支持配置 Ollama 服务地址（默认 http://localhost:11434）
- [ ] 支持选择可用模型列表
- [ ] 配置保存后立即生效
- [ ] 未配置时显示提示，引导用户配置
- [ ] Typecheck passes

### US-003: AI 对话界面
**Description:** 作为用户，我想在 AI 助手界面中发送消息并接收回复，以便通过自然语言完成任务。

**Acceptance Criteria:**
- [ ] 显示消息输入框，支持发送文字消息
- [ ] 展示对话历史（当前会话内）
- [ ] AI 回复以流式方式逐步显示
- [ ] 加载状态显示（思考中...）
- [ ] 连接状态指示（已连接/未连接）
- [ ] Typecheck passes

### US-004: 链接管理工具
**Description:** 作为用户，我想通过 AI 管理链接，包括添加、查看、修改、删除链接。

**Acceptance Criteria:**
- [ ] links_list: 列出所有链接，支持关键词和标签筛选
- [ ] links_add: 添加新链接，支持名称、URL、备注、标签
- [ ] links_update: 修改链接信息
- [ ] links_delete: 删除链接（需要确认）
- [ ] 工具执行结果以自然语言向用户反馈
- [ ] Typecheck passes

### US-005: Jenkins 管理工具
**Description:** 作为用户，我想通过 AI 查看 Jenkins Jobs 状态并触发构建。

**Acceptance Criteria:**
- [ ] jenkins_list_jobs: 列出所有 Jobs，支持关键词筛选
- [ ] jenkins_list_builds: 获取构建历史
- [ ] jenkins_trigger_build: 触发构建（需要确认）
- [ ] 工具执行结果以自然语言向用户反馈
- [ ] Typecheck passes

### US-006: 便签管理工具
**Description:** 作为用户，我想通过 AI 管理便签，包括添加、查看、修改、删除便签。

**Acceptance Criteria:**
- [ ] blackboard_list: 列出所有便签
- [ ] blackboard_add: 添加新便签
- [ ] blackboard_update: 修改便签内容
- [ ] blackboard_delete: 删除便签（需要确认）
- [ ] 工具执行结果以自然语言向用户反馈
- [ ] Typecheck passes

### US-007: 标签管理工具
**Description:** 作为用户，我想通过 AI 管理统一标签系统。

**Acceptance Criteria:**
- [ ] tags_list: 列出所有标签
- [ ] tags_add: 创建新标签
- [ ] tags_delete: 删除标签（需要确认）
- [ ] 标签可关联到链接和 Jobs
- [ ] Typecheck passes

### US-008: 录屏管理工具
**Description:** 作为用户，我想通过 AI 管理录屏功能。

**Acceptance Criteria:**
- [ ] recorder_list: 列出所有录制
- [ ] recorder_start: 开始录制（需要确认）
- [ ] recorder_stop: 停止录制
- [ ] Typecheck passes

### US-009: 热榜工具
**Description:** 作为用户，我想通过 AI 获取今日热榜内容。

**Acceptance Criteria:**
- [ ] hotnews_get: 获取今日热榜列表
- [ ] 返回结果包含标题、链接、来源等信息
- [ ] Typecheck passes

### US-010: 同步工具
**Description:** 作为用户，我想通过 AI 触发数据同步。

**Acceptance Criteria:**
- [ ] sync_trigger: 触发全局同步
- [ ] 返回同步结果（成功/失败/冲突数量等）
- [ ] Typecheck passes

### US-011: 危险操作确认弹窗
**Description:** 作为用户，当 AI 执行危险操作时，我想确认操作内容以防止误操作。

**Acceptance Criteria:**
- [ ] 删除操作（links_delete, blackboard_delete, tags_delete）触发确认弹窗
- [ ] 触发构建（jenkins_trigger_build）触发确认弹窗
- [ ] 开始录制（recorder_start）触发确认弹窗
- [ ] 弹窗显示操作描述和影响
- [ ] 用户可确认或取消操作
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: 在 Popup 中添加 AI 助手 Tab，默认显示
- FR-2: 实现 AI 配置页面，支持 Ollama 服务地址和模型选择
- FR-3: 实现 AI 对话界面，支持消息发送、流式响应、状态显示
- FR-4: 实现统一的工具定义格式（AIToolDefinition），兼容多模型
- FR-5: 实现工具注册中心，集中管理所有可用工具
- FR-6: 实现链接管理工具：list、add、update、delete、visit
- FR-7: 实现 Jenkins 管理工具：list_jobs、list_builds、trigger_build
- FR-8: 实现便签管理工具：list、add、update、delete
- FR-9: 实现标签管理工具：list、add、delete
- FR-10: 实现录屏管理工具：list、start、stop
- FR-11: 实现热榜工具：get
- FR-12: 实现同步工具：trigger
- FR-13: 危险操作需要用户通过弹窗确认后才能执行
- FR-14: 查询类操作直接执行，无需确认
- FR-15: 对话历史仅当前会话有效，刷新后清除

## Non-Goals

- 不支持多轮对话上下文记忆（刷新后清除）
- 不支持语音输入
- 不支持图片/文件上传
- 不实现复杂的 Agent 规划能力
- 不支持除 Ollama 外的其他模型（第一版）

## Design Considerations

- 复用现有的 Shadcn UI 组件（Button, Input, ScrollArea, Dialog 等）
- 保持与现有 Popup 风格一致
- 参考现有 Tab 切换模式实现 AI 助手 Tab

## Technical Considerations

- 使用 Ollama 的 /api/chat 接口进行对话
- 工具定义转换为 Ollama 格式（tools parameter）
- 模型提供商接口设计支持扩展其他模型
- 工具执行在 Popup 进程中直接操作数据库

## Success Metrics

- 用户可以通过自然语言完成至少 80% 的常用操作
- 危险操作确认率达到 100%
- AI 响应时间在 5 秒内（不含模型推理时间）

## Open Questions

- 是否需要支持对话历史持久化？
- 是否需要支持语音输入？
- 模型选择是否需要支持云端模型（OpenAI API）？
