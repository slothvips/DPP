import { BlackboardItem } from '../types';

export const SYSTEM_NOTES: BlackboardItem[] = [
  {
    id: 'system-welcome',
    content: `# 👋 欢迎使用 DPP (Developer Productivity Platform)

这是一个专为开发者打造的效率工具，旨在简化日常开发流程。

### 核心功能
- 🔗 **链接管理**：快速访问常用开发资源，支持标签分类
- 🏗️ **Jenkins 集成**：监控构建状态，快速触发构建
- 🎥 **屏幕录制**：基于 [rrweb](https://www.rrweb.io/) 的轻量级录屏，赋能禅道
- 📝 **黑板**：随手记录需求资料、开发笔记、或待办事项
- 🔄 **多端同步**：支持端到端加密的数据同步

开始探索吧！`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    pinned: false,
  },
  {
    id: 'system-qucik',
    content: `### 🚀 快速上手

1. **配置 Jenkins**：点击右上角设置图标，添加您的 Jenkins 服务器信息
2. **添加链接**：在链接页面添加常用文档或环境地址
3. **尝试录屏**：点击录制按钮，记录操作过程,然后在禅道bug 创建页面上传
4. **同步数据**：在设置中配置同步密钥，实现多设备数据共享

遇到问题？欢迎反馈！`,
    createdAt: Date.now() - 1000, // Slightly earlier so it appears after the main intro if sorted by time
    updatedAt: Date.now() - 1000,
    pinned: false,
  },
];
