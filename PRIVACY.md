# 隐私政策 (Privacy Policy)

**最后更新日期**: 2026年2月3日
**生效日期**: 2026年2月3日

---

## 概述

DPP ("本扩展") 尊重并保护用户隐私。本隐私政策说明了我们如何收集、使用、存储和保护您的个人信息。

**核心原则**：

- ✅ 所有数据默认存储在**您的本地设备**
- ✅ 不会在未经授权的情况下上传数据到任何服务器
- ✅ 可选的同步功能使用**端到端加密** (E2EE)
- ✅ 我们**无法访问**您的加密数据

---

## 1. 我们收集的信息

### 1.1 本地存储数据

以下数据仅存储在您的浏览器本地存储 (IndexedDB) 中，**不会自动上传到任何服务器**：

| 数据类型         | 包含内容                              | 用途                              |
| ---------------- | ------------------------------------- | --------------------------------- |
| **Jenkins 配置** | Jenkins 服务器地址、用户名、API Token | 连接 Jenkins 服务器、触发构建任务 |
| **团队链接**     | 链接名称、URL、备注、标签             | 管理团队常用链接                  |
| **使用统计**     | 链接访问次数、最后访问时间            | 提供"最近使用"功能                |
| **扩展设置**     | 界面偏好设置                          | 保存用户个性化配置                |

### 1.2 同步功能 (可选)

如果您**主动启用**数据同步功能：

- **加密传输**: 数据在上传前使用 AES-GCM 加密，只有您持有的加密密钥能解密
- **存储位置**: 您自己部署的同步服务器 (Cloudflare Workers 或 Node.js 服务器)
- **服务器无法解密**: 同步服务器只存储加密数据，无法读取内容

### 1.3 第三方服务访问

本扩展会访问以下第三方服务 (仅在您主动使用相关功能时)：

- **Jenkins 服务器**: 您配置的 Jenkins 地址 (用于获取任务列表、触发构建)
- **HackerNews API**: 获取技术资讯 (公开API，无需认证)
- **GitHub Trending**: 获取热门项目 (公开API，无需认证)

**我们不会向这些服务发送您的个人信息。**

---

## 2. 我们如何使用信息

我们收集的信息**仅用于**以下目的：

| 用途             | 说明                                |
| ---------------- | ----------------------------------- |
| **提供核心功能** | 存储和管理您的链接、Jenkins 配置    |
| **跨设备同步**   | (仅在您启用时) 同步数据到您的服务器 |
| **改善用户体验** | 记录使用统计，提供"最近使用"排序    |

**我们不会**：

- ❌ 将您的数据出售给第三方
- ❌ 用于广告或营销目的
- ❌ 在未经您同意的情况下分享您的数据

---

## 3. 数据存储和安全

### 3.1 本地存储

- **位置**: 浏览器 IndexedDB (chrome-extension://[扩展ID])
- **访问权限**: 只有本扩展可以访问
- **保护措施**: 浏览器沙箱隔离

### 3.2 同步服务器 (可选)

如果您启用同步功能：

- **端到端加密**: 使用 AES-256-GCM 加密
- **密钥管理**: 加密密钥仅存储在您的本地设备，**永不上传**
- **服务器访问**: 同步服务器只能看到加密数据，无法解密
- **传输安全**: 所有网络传输使用 HTTPS

### 3.3 敏感信息处理

- **Jenkins API Token**: 存储在本地加密数据库，仅在请求 Jenkins API 时使用
- **链接备注**: 可能包含敏感信息 (如密码)，建议启用同步加密

---

## 4. 权限说明

本扩展请求以下浏览器权限：

| 权限         | 用途           | 说明                               |
| ------------ | -------------- | ---------------------------------- |
| `storage`    | 存储配置和数据 | 保存链接、设置到本地 IndexedDB     |
| `alarms`     | 定时任务       | 定期同步数据、更新技术资讯         |
| `tabs`       | 标签页访问     | 地址栏快捷访问 (输入 `dpp` + 空格) |
| `<all_urls>` | 访问网站       | 调用 Jenkins API、注入内容脚本     |

**我们不会**：

- ❌ 追踪您的浏览历史
- ❌ 读取其他网站的敏感信息
- ❌ 在未经授权的情况下发送网络请求

---

## 5. 数据共享

我们**不会**与第三方共享您的个人数据，除非：

1. **法律要求**: 根据法律、法规或法律程序要求
2. **您的同意**: 在获得您明确同意的情况下
3. **服务提供商**: 您自己部署的同步服务器 (您完全控制)

---

## 6. 您的权利

您对自己的数据拥有完全控制权：

| 权利         | 如何操作                                             |
| ------------ | ---------------------------------------------------- |
| **查看数据** | 浏览器 DevTools → Application → IndexedDB → DPPDB    |
| **导出数据** | (功能开发中)                                         |
| **删除数据** | 扩展选项页 → "清空所有数据并重置"                    |
| **停用同步** | 扩展选项页 → 关闭同步功能                            |
| **卸载扩展** | chrome://extensions/ → 移除扩展 (将删除所有本地数据) |

---

## 7. Cookie 和追踪技术

本扩展**不使用** Cookie 或任何追踪技术。

我们**不会**：

- ❌ 追踪您的在线活动
- ❌ 收集匿名使用统计
- ❌ 使用第三方分析服务

---

## 8. 未成年人隐私

本扩展不针对 13 岁以下儿童。我们不会故意收集未成年人的个人信息。

---

## 9. 国际数据传输

- **本地优先**: 数据默认存储在您的本地设备
- **同步服务器位置**: 由您决定 (您自己部署的服务器位置)
- **加密保护**: 即使数据跨境传输，也受端到端加密保护

---

## 10. 隐私政策更新

我们可能会不时更新本隐私政策。更新时：

1. 在扩展页面显示通知
2. 更新本文档的"最后更新日期"
3. 如有重大变更，会在扩展中弹窗通知

---

## 11. 开源透明

本扩展代码**开源**，您可以审查源代码以验证我们的隐私承诺：

- **源代码仓库**: [[GitHub 仓库 URL](https://github.com/slothvips/DPP)]
- **安全审计**: 欢迎安全研究人员审查代码

---

## 12. 联系我们

如果您对本隐私政策有任何疑问或担忧，请通过以下方式联系我们：

- **邮箱**: [18512857416@163.com]
- **GitHub Issues**: [https://github.com/slothvips/DPP/issues]

我们会在 **7 个工作日内**回复您的询问。

---

## 13. 数据泄露应对

如果发生数据泄露事件：

1. **立即通知**: 我们会在发现后 72 小时内通知受影响用户
2. **泄露范围**: 说明受影响的数据类型和用户范围
3. **补救措施**: 提供必要的补救建议
4. **加密保护**: 由于使用端到端加密，即使数据泄露也无法被解密

---

## 14. 您的同意

使用本扩展即表示您已阅读并同意本隐私政策。

如果您不同意本政策，请不要使用本扩展。

---

## 附录: 常见问题

### Q1: 我的 Jenkins API Token 安全吗?

**A**: 是的。Token 存储在本地 IndexedDB 中，受浏览器沙箱保护。如果启用同步，会先加密再上传。

### Q2: 同步服务器能看到我的数据吗?

**A**: 不能。所有数据在上传前使用您的密钥加密，服务器只能看到加密数据。

### Q3: 如果丢失加密密钥怎么办?

**A**: 加密数据将**永久无法恢复**。请务必备份您的加密密钥。

### Q4: 卸载扩展后数据会保留吗?

**A**: 不会。卸载扩展会删除所有本地数据。同步服务器的数据需要手动删除。

---

**本政策使用 [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/) 许可协议**

---

## English Version

# Privacy Policy

**Last Updated**: February 3, 2026
**Effective Date**: February 3, 2026

### Overview

DPP ("the Extension") respects and protects user privacy. This Privacy Policy explains how we collect, use, store, and protect your personal information.

**Core Principles**:

- ✅ All data is stored **locally on your device** by default
- ✅ No data is uploaded to any server without your authorization
- ✅ Optional sync feature uses **end-to-end encryption** (E2EE)
- ✅ We **cannot access** your encrypted data

### 1. Information We Collect

**Locally Stored Data** (stored in browser IndexedDB only):

- Jenkins configurations (server URL, username, API Token)
- Team links (name, URL, notes, tags)
- Usage statistics (visit count, last used time)
- Extension settings

**Sync Feature** (optional):

- Encrypted data transmitted to your self-hosted server
- End-to-end encrypted with AES-256-GCM
- Server cannot decrypt your data

**Third-Party Services**:

- Your Jenkins server (when you use Jenkins features)
- HackerNews API (public, read-only)
- GitHub Trending (public, read-only)

### 2. How We Use Information

We use collected information **solely** for:

- Providing core features (link management, Jenkins integration)
- Cross-device synchronization (when enabled)
- Improving user experience (usage statistics)

We **do NOT**:

- ❌ Sell your data to third parties
- ❌ Use data for advertising or marketing
- ❌ Share data without your consent

### 3. Data Security

- **Local Storage**: Browser IndexedDB with sandbox isolation
- **Sync Encryption**: AES-256-GCM end-to-end encryption
- **Transport Security**: HTTPS for all network requests
- **Key Management**: Encryption keys never leave your device

### 4. Your Rights

- **View Data**: Browser DevTools → IndexedDB → DPPDB
- **Delete Data**: Extension Options → "Clear all data"
- **Export Data**: (Coming soon)
- **Disable Sync**: Extension Options → Turn off sync

### 5. Contact Us

For privacy concerns, contact us at:

- **Email**: [Your Contact Email]
- **GitHub**: [Your Repository URL]

---

**By using this extension, you agree to this Privacy Policy.**
