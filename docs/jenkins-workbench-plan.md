# Jenkins 开发者工作台重构计划

## 1. 文档目的

当前 Jenkins 模块已经支持环境配置、Job 采集、搜索、参数构建、构建取消、构建历史和实时日志。

但整体形态仍然是“Jenkins 缓存浏览器 + 构建入口”，用户在查看队列、构建详情、测试结果、产物、Pipeline 阶段和人工审批时仍需要回到 Jenkins 页面。

本计划的目标是将 Jenkins 日常开发工作尽可能收敛到 DPP 内，同时保留 Jenkins 原生页面作为管理员功能和兼容性兜底入口。

## 2. 已确定的产品边界

### 2.1 目标

构建面向开发者的 Jenkins 工作台，优先覆盖：

- 浏览和搜索 Job、Folder、Pipeline、Multibranch Job；
- 查看队列、排队原因和执行状态；
- 参数化构建、排队跟踪和重复提交保护；
- 停止运行中的构建和取消排队中的构建；
- 查看完整实时日志；
- 查看构建参数、变更、测试结果和产物；
- 查看 Pipeline 阶段、节点日志和人工审批；
- 失败重跑、同参数重跑和最近操作重放；
- 通过 AI、Omnibox 和深链接进入同一套工作流。

### 2.2 Pipeline 插件策略

Pipeline REST API 在运行时探测：

- 插件存在并且有权限时，显示阶段、节点日志和人工审批；
- 插件不存在、版本不兼容或权限不足时，回退到 Jenkins Core Remote API；
- 插件能力不可用必须显示明确的降级原因，不允许白屏或静默失败。

### 2.3 日志策略

日志默认显示原文，并提供一键切换到脱敏视图：

- 原始日志只保留在当前工作台会话内存；
- 原始日志不写入 Dexie、不进入同步、不进入配置导出；
- 默认不发送给 AI；
- 脱敏视图复用后台统一的脱敏规则；
- 日志使用增量读取、分块存储和虚拟渲染；
- 超出浏览器安全内存阈值时，不静默丢失内容，改为提供完整下载并明确提示显示限制。

### 2.4 暂不内建的功能

以下功能保留“在 Jenkins 中打开”：

- Job XML 配置编辑；
- Jenkins 节点和执行器管理；
- 插件安装、升级和卸载；
- Jenkins Credentials 管理；
- Jenkins 用户、权限和系统配置；
- 不同插件提供的专有管理页面。

## 3. 当前实现的主要风险

### 3.1 数据隔离

当前 Jobs 以 URL、Build 以 Build URL 作为主键，环境只保存在普通字段中。不同环境可能覆盖相同 URL 的数据。

涉及位置：

- `src/db/schema.ts`；
- `src/db/typesDomain.ts`；
- `src/lib/db/jenkinsMutations.ts`；
- `src/lib/db/jenkinsQueries.ts`。

### 3.2 URL 安全边界

当前 `assertJenkinsUrlAllowed()` 只验证 origin，没有限制 Jenkins context path。配置 `/jenkins` 时，同源的其他路径也可能携带 Jenkins 凭据。

需要同时验证：

- HTTP/HTTPS 协议；
- origin；
- Jenkins root pathname；
- 路径边界，例如 `/jenkins` 不能匹配 `/jenkins-other`；
- 编码后的 `..` 和路径逃逸；
- redirect 后的目标；
- Job/Build URL 与环境的归属关系。

### 3.3 错误语义

当前 API client 将 401、403、500、超时和网络错误都转换为 `null`，同步层可能继续写入不完整缓存并更新成功时间。

必须区分：

- 成功；
- 合法空结果；
- 部分成功；
- 认证失败；
- 权限不足；
- 资源不存在；
- CSRF 失败；
- 限流；
- 超时；
- 网络离线。

### 3.4 构建生命周期

触发接口返回 201、202 或 302 只代表请求被 Jenkins 接受，不能直接代表构建已成功或已经开始。

需要跟踪完整状态：

```text
提交请求
  -> 已接受
  -> 排队中
  -> 已创建 Build
  -> 运行中
  -> 暂停等待输入
  -> 成功 / 失败 / 取消 / 超时
```

### 3.5 日志资源风险

当前 progressive log 已经能够持续读取，但还需要补齐：

- 统一脱敏；
- AbortController；
- offset 严格前进；
- 无进展重试上限；
- 单次响应和累计读取保护；
- 分块和虚拟渲染；
- 暂停、继续、重试和下载；
- 网络断开后的恢复。

### 3.6 前端状态和性能

Jenkins 页面当前常驻挂载，可能在用户没有打开 Jenkins 时继续刷新构建历史。

另外，Job、Build、Tag 和树节点基本都是全量读取和渲染，5000 个节点的采集上限没有对应的分页、虚拟化和增量加载策略。

## 4. 目标架构

### 4.1 统一请求上下文

所有 Jenkins 请求都使用明确的环境上下文：

```ts
interface JenkinsRequestContext {
  envId: string;
  resourceId?: string;
  canonicalUrl?: string;
}
```

调用方只传 `envId` 和资源引用，不直接传 host、user、token，也不在业务组件中拼接完整 Jenkins URL。

### 4.2 统一 Client

扩展现有 client，提供类型化方法：

```text
listJobs
getJob
getJobParameters
getCapabilities
triggerBuild
getQueueItem
cancelQueueItem
getBuild
stopBuild
getProgressiveLog
getTestReport
getTestDetails
getArtifacts
downloadArtifact
getPipelineStages
getPipelineNodeLog
getPendingInput
proceedInput
abortInput
```

Client 统一负责 URL 校验、凭据解析、CSRF、请求超时、取消、响应 schema、错误分类、限流和日志脱敏。

### 4.3 能力探测

每个环境建立能力快照，至少包括：

- Jenkins 版本；
- 当前用户身份；
- Job Read/Discover/Build/Cancel 权限；
- Test Report 能力；
- Pipeline REST API 能力；
- Artifact 能力；
- Queue 查询和取消能力；
- 参数类型支持情况。

UI 和 AI 使用同一份能力快照，不根据单个 HTTP 200 结果自行推断能力。

## 5. 数据模型重构

不直接修改旧表的主键，新增 Jenkins 专用表并通过 Dexie 新版本迁移：

| 表                       | 主键                   | 用途                            |
| ------------------------ | ---------------------- | ------------------------------- |
| `jenkinsJobs`            | `[envId+url]`          | Job 和 Folder 缓存              |
| `jenkinsBuilds`          | `[envId+id]`           | 统一的全部构建记录              |
| `jenkinsQueueItems`      | `[envId+queueId]`      | 队列项目和生命周期              |
| `jenkinsJobTags`         | `[envId+jobUrl+tagId]` | 环境内 Job 标签                 |
| `jenkinsSyncState`       | `envId`                | 刷新、stale、partial 和错误状态 |
| `jenkinsBuildOperations` | 操作 ID                | 触发、取消、重跑和恢复状态      |

Build 不再拆成 `myBuilds` 和 `othersBuilds`，改为统一模型：

```ts
interface JenkinsBuildRecord {
  id: string;
  envId: string;
  jobUrl: string;
  number: number;
  result?: string;
  lifecycle: 'queued' | 'running' | 'paused' | 'completed' | 'unknown';
  building: boolean;
  owner?: string;
  timestamp: number;
  duration?: number;
  lastSeenAt: number;
}
```

迁移要求：

1. 兼容 v1-v26 数据库；
2. 兼容旧版 `jenkins_host`、`jenkins_user`、`jenkins_token`；
3. 迁移可重复执行；
4. 迁移失败时保留旧数据；
5. 无法判断环境的数据不得静默覆盖；
6. 删除环境时清理所有关联缓存、标签、队列和操作记录；
7. Jenkins 缓存、日志和产物默认不进入 SyncEngine；
8. 配置导出默认不包含 Token，显式导入时再次确认。

## 6. 同步和缓存策略

采用环境快照，而不是只做 `bulkPut`：

1. 为一次同步生成 `syncId`；
2. 每条资源写入 `lastSeenSyncId`；
3. 根请求成功后清理本次快照中不存在的旧资源；
4. 根请求失败时保留旧数据，不更新成功刷新时间；
5. 目录级失败标记为 partial，不清理未知目录；
6. UI 显示最后成功时间、stale、offline 和 partial 状态；
7. 构建状态轮询优先查询活动 Build，不重复遍历完整 Job 树；
8. 根据 429、网络状态和页面可见性使用退避策略。

## 7. 参数和构建操作

### 7.1 参数支持

第一阶段支持：

- String；
- Text；
- Boolean；
- Choice；
- Password，默认遮蔽；
- File，使用 multipart 上传并设置大小上限。

以下参数需要能力探测和降级：

- Credentials；
- Run；
- Active Choices；
- Extended Choice；
- 插件自定义参数。

不支持时必须说明原因，并提供 Jenkins 原生页面入口。

### 7.2 防重复构建

网络超时不能直接重试 POST，因为 Jenkins 可能已经接受请求。

每次触发记录操作状态和参数摘要：

- 请求已发送但结果未知时，先查询 queue；
- 根据 queue、Job 最近构建和可验证参数恢复状态；
- 无法确认时提示用户手动确认，不自动再次触发；
- 所有写操作都需要明确展示环境、Job、参数摘要和目标动作。

### 7.3 取消操作

明确区分：

- 取消队列项；
- 停止运行中 Build；
- Pipeline `stop`；
- Pipeline `term` 和 `kill` 暂不作为普通按钮，必要时保留 Jenkins 页面入口。

## 8. 日志、测试和产物

### 8.1 日志

- 使用 `/logText/progressiveText?start=N`；
- 依据 `X-Text-Size` 推进 offset；
- `X-More-Data` 为 true 时继续轮询；
- offset 不前进时停止当前轮询并退避；
- 支持取消、暂停、继续、重试和下载；
- 原文和脱敏视图切换；
- 日志不写数据库、不导出、不同步；
- 统一限制响应、读取时间和浏览器内存；
- 使用日志行虚拟化，避免完整文本一次性渲染。

### 8.2 测试报告

至少区分：

- 尚未完成；
- 没有测试报告；
- 无权限；
- 报告读取失败；
- 有通过、跳过和失败结果。

后续支持测试用例、失败栈、趋势和 Flaky 标记。

### 8.3 产物

第一阶段显示文件名、路径、大小和可用状态，随后支持安全下载：

- 校验环境和 Build 归属；
- 限制单文件和总下载大小；
- 不允许任意跨域下载；
- 处理外部 Artifact Manager URL；
- 不默认长期缓存产物。

## 9. UI 信息架构

Jenkins 改为 sidepanel 一级工作台，只有首次打开后才挂载和轮询。

建议三个一级视图：

### 9.1 运行

- 正在排队；
- 正在构建；
- 最近失败；
- 我的最近构建；
- 连接状态和最后刷新时间。

### 9.2 任务

- Job/Folder 树；
- 搜索和多关键词过滤；
- 状态、标签和收藏过滤；
- 最近使用；
- Job 详情抽屉；
- 构建入口。

### 9.3 队列

- 排队原因；
- 阻塞原因；
- 预计执行节点；
- 取消排队；
- 队列过期和权限错误。

Job 详情和 Build 详情尽量在 DPP 内完成，包括日志、测试和产物。只有管理员功能、未支持的插件参数和明确点击“打开 Jenkins”时离开应用。

UI 必须同时支持：

- 键盘操作；
- `aria-expanded`、`aria-controls` 和明确标签；
- 不嵌套按钮；
- 不依赖 hover 才显示关键动作；
- 窄窗口和移动式 sidepanel；
- 大数据虚拟化；
- stale/offline/partial/error 状态。

## 10. AI、Omnibox 和深链接

所有入口统一使用：

```ts
interface JenkinsResourceRef {
  envId: string;
  type: 'job' | 'queue' | 'build';
  id: string;
  canonicalUrl?: string;
}
```

要求：

- AI 查询必须带环境和资源身份；
- AI 能读取状态、队列、测试和产物元数据；
- AI 默认只能读取脱敏日志尾部；
- AI 不自动读取完整原始日志；
- 构建、取消、Token 生成、环境变更始终需要确认；
- YOLO 模式也不能绕过上述确认；
- Omnibox 多环境同 URL 时必须先选择环境；
- 非法 deep link 不能修改当前环境；
- Recent Actions 不保存 Token、原始日志和敏感参数；
- recent action 恢复失败时显示可解释的过期原因。

## 11. 安全和权限

### 11.1 凭据

- Token 复用项目现有本地加密存储能力；
- 配置导出默认排除 Token；
- 自动生成 Token 必须显式命名和确认；
- 不在日志、错误、AI 结果和诊断包中输出凭据；
- 指定不存在的环境 ID 永远报错，不回退其他环境。

### 11.2 Content Script 和 Proxy

收紧或删除通用 `JENKINS_API_REQUEST`：

- 不允许调用方覆盖 Authorization、Cookie；
- 限制 HTTP method；
- 限制 endpoint、body 和 timeout；
- 限制到已批准 Jenkins root；
- 禁止通过 iframe 扩大调用范围；
- Jenkins content script 不再匹配所有页面后执行复杂逻辑；
- 评估 optional host permissions 和动态注册。

### 11.3 CSRF 和 redirect

- 优先使用 API Token；
- POST 需要 crumb 时统一获取并分类处理；
- crumb 失效时提示重新认证，不静默重复危险操作；
- 禁止未验证的 redirect；
- redirect 到不同 origin 或不同 Jenkins root 必须拒绝。

## 12. Feature Flag 和发布策略

按能力拆分开关，而不是只有一个 Jenkins 总开关：

- `jenkins_workbench_v2`；
- `jenkins_queue`；
- `jenkins_build_lifecycle`；
- `jenkins_full_log`；
- `jenkins_pipeline_features`；
- `jenkins_artifacts`；
- `jenkins_ai_actions`。

发布顺序：

1. 只读和数据迁移；
2. Queue 和构建状态；
3. 构建和取消；
4. 日志、测试和产物；
5. Pipeline 操作；
6. AI 写操作。

Dexie schema 不能依赖扩展回滚恢复。新版本必须能在能力关闭时继续读取旧缓存，并提供迁移失败的诊断信息。

## 13. 分阶段实施

### Phase 0：契约、fixture 和兼容矩阵

交付：

- Jenkins Core/插件/Job 类型支持矩阵；
- URL canonical 规则；
- queue/build/log/test/artifact 状态机；
- API 错误模型；
- fake Jenkins HTTP fixture；
- 威胁模型和数据分类。

验收：

- 覆盖 Freestyle、Pipeline、Folder、Multibranch 和 Organization Folder；
- 明确 Matrix/Maven 和自定义插件的支持或降级方式；
- 覆盖 context path、反向代理、401、403、404、429、CSRF、redirect 和字段缺失；
- 每个能力都有支持、降级或不可用状态。

### Phase 1：安全和数据基础

交付：

- 新 Jenkins 表；
- Dexie 迁移；
- 环境作用域；
- root path 校验；
- Runtime Message schema；
- Token 加密和导出保护；
- 代理和 content script 收敛。

验收：

- v1-v26 和 legacy 配置迁移成功；
- 不同环境不再互相覆盖；
- 不向 root path 外的同源地址发送凭据；
- 迁移失败保留旧数据；
- Jenkins Token、日志和产物不进入同步与导出。

### Phase 2：只读工作台

交付：

- Job/Build/Queue 读取；
- Build 详情；
- 测试汇总；
- 产物元数据；
- stale/offline/partial 状态；
- 分页和虚拟化。

验收：

- 大型 Job 列表不阻塞 sidepanel；
- 删除 Job、权限变化和部分失败不会永久污染缓存；
- 用户能看出数据是否过期、离线或不完整；
- 插件缺失时有明确降级。

### Phase 3：Queue 和构建生命周期

交付：

- trigger 返回 queue reference；
- queue 轮询；
- 取消排队；
- Build 创建和状态跟踪；
- 停止运行中 Build；
- 防重复提交；
- 刷新后的恢复。

验收：

- 能显示排队原因和最终 Build；
- 网络重试不会自动重复构建；
- 403、crumb 失效、queue 超时和 Build 已结束有准确提示；
- 所有写操作显示环境、Job、参数摘要和确认信息。

### Phase 4：实时日志、测试详情和产物

交付：

- 有界 progressive log；
- 原文/脱敏切换；
- 暂停、继续、重试、下载；
- 测试用例和失败详情；
- 产物下载；
- Pipeline REST API 能力探测；
- 阶段、节点日志和人工审批。

验收：

- Unicode、长日志、缺失 Header、权限不足和网络中断均有测试；
- 日志不会无限重复请求或无限渲染；
- 原始日志不进入 AI、同步或导出；
- 产物下载有环境、大小和权限校验。

### Phase 5：UI 和入口统一

交付：

- Jenkins 一级工作台；
- `运行 / 任务 / 队列` 视图；
- Job/Build 详情抽屉；
- 合并 Job 行和树节点组件；
- 统一普通构建、AI、Omnibox、Deep Link 和 Recent Actions。

验收：

- 日常开发流程不需要打开 Jenkins 页面；
- 键盘、屏幕阅读器、窄窗口和触摸场景可用；
- 未激活 Jenkins 时不挂载、不轮询；
- 所有入口都保留 `envId` 和 canonical resource identity。

### Phase 6：AI、灰度和观测

交付：

- AI 状态查询和生命周期操作；
- 不可绕过的高风险确认；
- 能力级 feature flag；
- 本地脱敏诊断；
- 请求、缓存、queue 和日志指标；
- Chrome/Firefox 和真实 Jenkins 验证。

验收：

- 可单独关闭高风险能力；
- YOLO 不能绕过构建、取消、Token 生成和环境修改确认；
- 能诊断认证、CSRF、queue 超时、插件缺失和 stale；
- 完成旧数据库、反向代理、context path 和扩展升级验证。

## 14. 测试计划

### 14.1 API 和安全

- URL protocol、origin、root path、路径边界和 `..`；
- redirect 和不同 context path；
- 401、403、404、429、500、超时和离线；
- CSRF crumb 获取、失效和权限不足；
- Runtime Message payload 类型、长度和额外字段；
- Authorization/Cookie header 注入；
- 非法 envId 和资源归属不匹配。

### 14.2 数据和迁移

- v1-v26 数据升级；
- legacy 配置迁移；
- 迁移重复执行；
- 中途失败恢复；
- 同 URL 多环境并存；
- 环境删除清理；
- 标签、导出和同步隔离。

### 14.3 构建生命周期

- 201、202、302 和缺失 Location；
- queue 成功、阻塞、失败、过期和取消；
- Build 创建、运行、暂停、完成和被删除；
- 网络不确定状态防重复提交；
- 运行中停止和已完成构建的竞态。

### 14.4 日志、测试和产物

- progressive offset 严格前进；
- 缺失、非法和回退 Header；
- Unicode；
- 持续 `X-More-Data`；
- 脱敏规则；
- 超大日志、取消和断线恢复；
- 测试报告缺失、权限不足和失败详情；
- 产物大小、权限、跨域和外部存储。

### 14.5 UI 和入口

- 未激活模块不轮询；
- stale/offline/partial/error 状态；
- 虚拟列表和大数据；
- 键盘、ARIA、焦点和窄窗口；
- AI 环境传递；
- 多环境 Omnibox；
- 非法 Deep Link 不修改环境；
- Recent Action 过期和资源不存在。

## 15. 开工顺序

第一轮不直接重做 UI，按以下顺序实施：

1. 建立 fake Jenkins fixture 和 API 契约；
2. 修复 URL root path、环境 fallback、日志安全和消息校验；
3. 设计并实现 Dexie 新表及迁移；
4. 统一 Jenkins Client 和错误模型；
5. 实现 queue/build 生命周期；
6. 再将 UI 迁移到新的工作台数据流；
7. 最后接入 Pipeline 增强、AI 和高级入口。

每个阶段都必须先通过对应测试和迁移验证，再开放下一个 feature flag，避免在旧数据模型和不稳定 API 上继续堆叠 UI 功能。
