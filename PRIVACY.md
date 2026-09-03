# DPP 隐私政策 / Privacy Policy

**最后更新日期 / Last updated:** 2026年9月3日 / September 3, 2026  
**生效日期 / Effective date:** 2026年9月3日 / September 3, 2026

本政策适用于 DPP 浏览器扩展（以下简称“DPP”或“本扩展”）。DPP 是一个本地优先的开发和团队工作工具。本政策说明 DPP 收集、使用、存储和共享哪些数据，以及您如何控制这些数据。

This policy applies to the DPP browser extension. DPP is a local-first development and team-work tool. It explains what data DPP collects, how it is used, where it is stored, when it is shared, and how you can control it.

## 1. 数据控制者和联系方式 / Controller and contact

DPP 由开源项目维护者运营。隐私问题、数据请求或安全问题请联系：

- 邮箱 / Email: `18512857416@163.com`
- GitHub: https://github.com/slothvips/DPP/issues

## 2. 我们处理的数据 / Data we process

除非本政策另有说明，DPP 不会因为安装扩展而自动收集或上传个人数据。DPP 处理的数据可能包括以下内容：

### 2.1 您主动输入或导入的数据

- 链接、链接名称、分类、备注、标签和访问次数；
- 黑板内容、团队资料、测试物料和测试执行结果；
- Jenkins 服务器地址、用户名、访问令牌、任务参数、任务结果和构建用户名；
- TOTP/验证器账户名称、发行方、密钥及生成的验证码配置；
- AI 服务地址、模型、API 密钥、AI 对话标题、提示词、回答、工具调用、推理元数据和您提交的图片；
- DPP 设置、功能开关、同步配置、访问令牌和本地客户端标识符；
- 您导入的配置文件或录制文件。

### 2.2 网页任务和浏览器录制数据

当您主动使用网页助手或开始录制时，DPP 可能处理当前网页及任务相关标签页的：

- 页面 URL、标题、DOM/页面结构、用户操作和任务状态；
- 网页控制台日志；
- 网络请求的 URL、方法、时间、状态、请求/响应头和可读取的请求/响应内容；
- rrweb 页面事件流，包括页面结构、文本、表单变化、鼠标和键盘交互等内容。

这些数据可能包含您访问网站时提交的个人信息、会话标识、令牌或其他敏感内容。录制数据默认保存在本地，只有在您主动导出、同步或发送给 AI 服务时才会离开设备。请勿录制您无权处理的页面内容。

### 2.3 自动产生的技术数据

DPP 可能在本地保存任务时间、同步游标、操作记录、错误信息和近期操作记录，用于恢复任务、执行同步、排查故障和显示最近使用内容。DPP 不运行广告、画像或第三方分析服务，也不建立跨网站的浏览历史档案。

## 3. 数据用途 / How we use data

DPP 仅为以下目的处理数据：

1. 提供链接、黑板、Jenkins、TOTP、技术资讯、网页录制和网页助手等用户主动启用的功能；
2. 保存设置、恢复本地任务、展示历史记录和近期操作；
3. 在您开启同步后，在您的设备之间同步指定数据；
4. 在您主动发起 AI 请求时，将必要的对话上下文和任务上下文发送给您选择的 AI 服务并显示结果；
5. 在您主动使用 Jenkins 功能时，向您配置的 Jenkins 服务器发起请求；
6. 处理您主动提交的支持请求，并维护扩展安全和稳定性。

DPP 不会将数据用于广告、出售、信用评估、个性化营销或与用户功能无关的画像。DPP 不会为了收集数据而追踪您的浏览活动。

## 4. 数据发送给谁 / Who receives data

数据是否离开设备取决于您使用的功能和配置：

### 4.1 AI 服务

使用 AI 助手时，您的提示词、对话上下文、网页任务上下文、工具调用和可选图片会发送到您在 DPP 中选择的 AI 服务地址。服务可能包括 Anthropic、Google Gemini、OpenCode 或您配置的其他 OpenAI 兼容服务。API 密钥通过请求认证发送给对应服务。

这些服务由各自的运营方独立控制，可能按照各自的隐私政策和数据保留规则处理请求。请在发送敏感内容前阅读相应服务的政策。DPP 不控制第三方服务如何保留或使用其收到的数据。

### 4.2 Jenkins

使用 Jenkins 功能时，DPP 会向您配置的 Jenkins 地址发送认证请求、任务查询、构建触发或取消请求。Jenkins 服务器将按照其运营方的规则处理这些请求和返回数据。

### 4.3 您配置的同步服务器

开启同步后，DPP 仅同步属于已启用同步范围的数据。同步数据在发送前使用您设备上的同步密钥进行 AES-GCM 加密；同步服务器通常可看到请求时间、客户端标识符、操作类型、表名、数据大小和加密载荷等技术元数据，但无法使用其自身数据解密载荷。

同步服务器由您或您的组织配置和控制。DPP 不运营默认的同步服务器，也不会将同步密钥上传到同步服务器。同步服务器使用 `http://` 时传输可能未加密；生产环境应使用您信任的 HTTPS 服务器。

### 4.4 公开信息服务

使用技术资讯或更新日志功能时，DPP 可能从公开的 Hacker News、GitHub Trending、GitHub 仓库或相关公开地址读取内容。这些请求不包含您的链接、对话、凭据或录制内容。

除上述情况外，DPP 不向第三方出售或提供您的个人数据。法律要求、保护安全以及处理您主动提交的支持请求除外；在法律允许的范围内，我们会尽量通知您。

## 5. 存储位置和保留期限 / Storage and retention

- **本地数据：** 链接、凭据、AI 对话、录制、TOTP、任务和设置默认保存在浏览器扩展的 IndexedDB、`chrome.storage` 或网页存储中，并保留至您删除、清空数据、卸载扩展或浏览器清除这些数据。
- **导出文件：** 导出的 JSON 或录制文件由您选择保存位置；DPP 无法控制操作系统或其他应用对其的保留时间。
- **同步数据：** 加密同步数据保留在您配置的同步服务器上，期限由该服务器的管理员、服务器配置和删除操作决定。卸载 DPP 不会自动删除同步服务器上的数据。
- **AI/Jenkins/公开服务：** 请求和返回数据的保留期限由对应服务运营方的政策和配置决定。

DPP 不在开发者自有服务器上建立用户账户，也不维护用于广告或分析的用户画像数据库。

## 6. 安全措施 / Security

- 同步数据在上传前使用设备上的密钥进行 AES-GCM 加密；团队数据和个人数据使用不同的同步密钥范围；
- AI API 密钥在支持的本地配置路径中加密保存，密钥材料保存在本地；
- 浏览器扩展页面使用浏览器提供的存储隔离；
- 网络请求尽量使用 HTTPS，但您配置的 Jenkins 或同步服务器地址可能允许 HTTP，连接安全由该服务器配置决定；
- DPP 不会在日志中主动记录完整的 API 密钥，但网页录制和控制台内容本身可能包含敏感数据。

任何本地存储或网络传输都不能保证绝对安全。请使用强密码、HTTPS、可信的 AI/Jenkins/同步服务器，并妥善保管导出文件和同步密钥。

## 7. 您的控制权 / Your choices and rights

您可以：

- 在设置页关闭不需要的功能和自动同步；
- 使用设置页的数据导出功能导出可导出的配置和记录；
- 使用“清空所有数据”删除 DPP 在当前设备上的本地数据；
- 删除录制、对话、链接、TOTP 和其他记录；
- 卸载扩展以移除浏览器中的扩展数据；
- 登录您配置的同步服务器，单独删除服务器上的同步数据；
- 联系我们查询、纠正或删除由支持请求产生的数据，并提出隐私问题。

由于 DPP 默认不在开发者服务器上保存用户账户数据，我们通常无法恢复或直接删除只存在于您设备、第三方服务或您自建同步服务器上的数据。请向相应的设备管理员或服务运营方提出请求。

## 8. Cookie、追踪和儿童隐私 / Cookies, tracking, and children

DPP 不使用 Cookie、广告标识符、第三方分析 SDK 或跨网站追踪技术。DPP 不面向 13 岁以下儿童，也不会明知收集 13 岁以下儿童的个人信息。

## 9. 权限说明 / Browser permissions

- `storage`：保存设置、链接、任务和其他用户数据；
- `sidePanel`：提供侧边栏工作界面；
- `alarms`：执行用户启用的定时同步或资讯更新；
- `scripting`、`tabs`、`tabGroups`：在用户主动使用网页助手、录制或标签页相关功能时读取和操作相关标签页；
- `clipboardWrite`：执行用户主动发起的复制操作；
- `<all_urls>`：让用户在任意网站上使用网页助手、录制、网络/控制台查看及相关页面功能。

权限不会改变本政策所述的数据用途。网页权限使 DPP 能够处理当前网页内容，但 DPP 不会因获得权限而自动把所有浏览历史上传给开发者。

## 10. 政策更新 / Changes to this policy

我们可能因功能、法律或数据处理方式变化而更新本政策。更新后会修改本页面的“最后更新日期”。重大变化会在扩展中或发布页面以合理方式提示。继续使用 DPP 即表示您已阅读更新后的政策；如不同意，请停止使用并删除本扩展及相关数据。

## 11. 开源代码 / Open source

DPP 源代码公开于： https://github.com/slothvips/DPP

源代码公开不代表第三方服务受 DPP 控制；使用 AI、Jenkins 或同步服务时，仍应阅读相应运营方的政策。

---

# English Summary

DPP is a local-first browser extension. It does not automatically collect or upload personal data merely because it is installed. Depending on the features you use, DPP may process locally stored links, notes, tags, blackboard content, Jenkins credentials and build metadata, TOTP accounts, AI settings and conversations, test materials, browser-task state, and browser recordings.

When you actively use web assistance or recording, the extension may process the current page's URL, DOM, visible content, user interactions, console logs, and network request information, including headers and readable bodies. These records may contain sensitive information. They remain local unless you explicitly export, sync, or send them to an AI provider.

When you use an AI feature, the relevant prompts, conversation context, page context, tool calls, and optional images are sent to the AI provider endpoint you configured, such as Anthropic, Google Gemini, OpenCode, or another compatible provider. When you use Jenkins features, requests and credentials are sent to the Jenkins server you configured. Those services operate independently under their own policies.

When optional sync is enabled, selected sync data is encrypted on your device with AES-GCM before being sent to the sync server you configured. The server may see technical metadata such as timestamps, client identifiers, operation types, table names, and encrypted payloads, but it cannot decrypt the payload without your key. You are responsible for the sync server and its retention. DPP does not operate a default sync server.

DPP does not sell personal data, use it for advertising, run third-party analytics, or track browsing history for unrelated purposes. Local data remains until you delete it, clear extension data, or uninstall the extension. Exported files and data held by AI, Jenkins, public-information, or sync services are governed by the relevant device administrator or service operator. Contact `18512857416@163.com` or https://github.com/slothvips/DPP/issues for privacy questions or data requests.
