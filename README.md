# DPP

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![React](https://img.shields.io/badge/React-19-61dafb.svg)
![WXT](https://img.shields.io/badge/Framework-WXT-44cc11.svg)
![AI Generated](https://img.shields.io/badge/AI_Generated-Yes-purple.svg)

> **注意**: 本项目是 **Vibe Coding(氛围编程)** 的产物 —— 代码、文档以及本 README 均由 AI 完全生成。

DPP (Developer Productivity Pack) 是一个为开发团队设计的浏览器扩展，旨在通过整合日常高频工作流来提升开发效率。

它集成了 Jenkins 一键部署、团队链接统一管理以及技术资讯聚合等功能，坚持**本地优先**的数据策略，并提供可选的**端到端加密**同步服务。

### 🚀 Jenkins 一键部署

- **无缝集成**: 在 Jenkins 构建页面直接注入"一键部署"按钮。
- **参数预填**: 支持配置常用构建参数，告别重复输入。
- **实时状态**: 实时查看构建任务状态和历史记录。

### 🔗 团队链接管理

- **统一入口**: 集中管理团队文档、监控面板、工具入口等。
- **智能搜索**: 支持标签分类、模糊搜索，记录访问频率智能排序。
- **Omnibox**: 在地址栏输入 `dpp` + 空格，即可快速搜索并跳转。

### 📰 技术资讯聚合

- **热点追踪**: 实时聚合 HackerNews 热门文章和 GitHub Trending 项目。
- **自动更新**: 定时自动获取最新动态，保持技术敏锐度。

### 🔒 隐私与安全

- **本地优先**: 所有数据默认存储在浏览器本地 IndexedDB (Dexie.js)。
- **端到端加密**: 启用同步时，数据在本地使用 AES-256-GCM 加密后传输。
- **自主可控**: 同步服务器可自行部署 (支持 Cloudflare Workers / Node.js)，密钥永不离手。

## 🛠️ 技术栈

- **Core**: [WXT (Web Extension Tools)](https://wxt.dev)
- **UI Framework**: React 19 + TypeScript
- **Styling**: UnoCSS + Shadcn/ui (Theme variables)
- **State/DB**: Dexie.js (IndexedDB wrapper) + dexie-react-hooks
- **Icons**: Lucide React
- **Package Manager**: pnpm

## 📦 安装与使用

### 从源码构建

1. **克隆仓库**

   ```bash
   git clone <your-repo-url>
   cd DPPV5
   ```

2. **安装依赖**

   ```bash
   pnpm install
   ```

3. **构建项目**

   ```bash
   pnpm build
   # 构建产物位于 .output/chrome-mv3 目录
   ```

4. **加载到浏览器**
   - **Chrome**: 打开 `chrome://extensions/` -> 开启"开发者模式" -> 点击"加载已解压的扩展程序" -> 选择 `.output/chrome-mv3` 文件夹。
   - **Firefox**: 打开 `about:debugging` -> "此 Firefox" -> "临时载入附加组件" -> 选择 `.output/firefox-mv3/manifest.json`。

## 💻 本地开发

```bash
# 启动 Chrome 开发服务 (支持热重载)
pnpm dev

# 启动 Firefox 开发服务
pnpm dev:firefox

# 运行类型检查
pnpm compile

# 代码风格检查与修复
pnpm lint:fix
pnpm format

# 运行单元测试
pnpm test
```

## 📂 目录结构

```
src/
├── entrypoints/         # WXT 入口 (background, popup, content scripts)
├── components/          # React 组件 (ui: 通用组件, feature: 业务组件)
├── features/            # 核心业务模块 (jenkins, links, hotNews)
├── db/                  # Dexie 数据库定义与 Sync 逻辑
├── lib/                 # 核心库 (crypto, sync engine)
└── utils/               # 工具函数
```

## 🔐 隐私政策

DPP 严格遵守隐私保护原则：

- 不收集用户个人信息。
- 不使用 Cookie 或追踪技术。
- 未经授权不会上传任何数据。
- [查看详细隐私政策](./PRIVACY.md)

## 📄 许可证

MIT License
