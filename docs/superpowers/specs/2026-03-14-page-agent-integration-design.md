# Page-Agent 集成设计文档

## 概述

将阿里巴巴开源的 `page-agent` 库集成到 DPP 浏览器扩展中，为用户提供 AI 驱动的页面自动化能力。

## 目标

- 在 AI 助手中添加 "Page Agent" 按钮
- 点击后将 PageAgent 注入到当前活动标签页
- 复用现有 AI 配置（provider, baseUrl, apiKey, model）
- 使用 PageAgent 内置 Panel 提供交互界面

## 架构设计

### 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                      DPP Sidepanel                          │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    AI Assistant View                     ││
│  │  ┌─────────────┐                                        ││
│  │  │ Page Agent  │  ← 新增按钮                            ││
│  │  │   按钮      │                                        ││
│  │  └──────┬──────┘                                        ││
│  └─────────┼───────────────────────────────────────────────┘│
└────────────┼────────────────────────────────────────────────┘
             │ 点击
             ▼
┌────────────────────────────────────────────────────────────┐
│              Background Service Worker                      │
│  1. 获取当前活动标签页 ID                                   │
│  2. 读取 AI 配置 (storage)                                  │
│  3. 通过 chrome.scripting.executeScript 注入                │
└────────────────────────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────┐
│                    目标页面 (Content Script)                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              PageAgent Panel (内置 UI)                │  │
│  │  • 用户输入任务                                       │  │
│  │  • 显示 AI 思考过程                                   │  │
│  │  • 显示操作结果                                       │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  PageAgent 自动操作 DOM                                    │
└────────────────────────────────────────────────────────────┘
```

### 核心流程

1. 用户在 AI 助手界面点击 "Page Agent" 按钮
2. Background 获取当前标签页，读取 AI 配置
3. 将 `page-agent` 包 + 初始化代码注入目标页面
4. PageAgent 在目标页面初始化并显示 Panel
5. 用户通过 Panel 与 PageAgent 交互

## 模块设计

### 文件结构

```
src/
├── lib/
│   └── pageAgent/
│       ├── index.ts           # 导出入口
│       ├── injector.ts        # 注入逻辑
│       └── types.ts           # 类型定义
├── features/
│   └── aiAssistant/
│       └── components/
│           └── AIAssistantView.tsx  # 添加 Page Agent 按钮
└── entrypoints/
    └── background/
        └── handlers/
            └── pageAgent.ts   # Background 消息处理
```

### 模块职责

| 模块 | 职责 |
|------|------|
| `injector.ts` | 封装注入逻辑：获取配置、构建初始化代码、执行注入 |
| `pageAgent.ts` (background handler) | 处理来自 sidepanel 的注入请求消息 |
| `AIAssistantView.tsx` | 添加按钮，发送注入请求消息 |

### 类型定义

```typescript
// src/lib/pageAgent/types.ts

export interface PageAgentConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface PageAgentInjectRequest {
  type: 'PAGE_AGENT_INJECT';
}

export interface PageAgentInjectResponse {
  success: boolean;
  error?: string;
}
```

### 注入器实现

```typescript
// src/lib/pageAgent/injector.ts

import type { PageAgentConfig } from './types';

/**
 * 检测 URL 是否允许注入
 */
export function isInjectable(url: string): boolean {
  const blockedPrefixes = [
    'chrome://',
    'edge://',
    'about:',
    'chrome-extension://',
    'https://chrome.google.com/webstore',
  ];
  return !blockedPrefixes.some(prefix => url.startsWith(prefix));
}

/**
 * 注入 PageAgent 到指定标签页
 */
export async function injectPageAgent(
  tabId: number,
  config: PageAgentConfig
): Promise<{ success: boolean; error?: string }> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: initPageAgent,
      args: [config],
    });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '注入失败',
    };
  }
}

/**
 * 在目标页面执行的初始化函数
 */
async function initPageAgent(config: PageAgentConfig): Promise<void> {
  // 动态导入 page-agent
  const { PageAgent } = await import('page-agent');

  // 初始化实例
  const agent = new PageAgent({
    baseURL: config.baseUrl,
    apiKey: config.apiKey,
    model: config.model,
    language: 'zh-CN',
  });

  // 显示 Panel
  agent.panel.show();

  // 挂载到 window 以便调试
  (window as any).__DPP_PAGE_AGENT__ = agent;
}
```

### Background Handler

```typescript
// src/entrypoints/background/handlers/pageAgent.ts

import { injectPageAgent, isInjectable } from '@/lib/pageAgent/injector';
import { getAIConfig } from '@/lib/db/settings';
import type { PageAgentInjectRequest, PageAgentInjectResponse } from '@/lib/pageAgent/types';

export async function handlePageAgentInject(
  request: PageAgentInjectRequest,
  tabId: number
): Promise<PageAgentInjectResponse> {
  // 1. 获取当前标签页
  const tab = await chrome.tabs.get(tabId);

  if (!tab.url || !isInjectable(tab.url)) {
    return { success: false, error: '无法在此页面使用 Page Agent' };
  }

  // 2. 读取 AI 配置
  const aiConfig = await getAIConfig();

  if (!aiConfig?.apiKey && aiConfig?.provider !== 'webllm') {
    return { success: false, error: '请先配置 AI 服务' };
  }

  // 3. 注入 PageAgent
  return injectPageAgent(tabId, {
    baseUrl: aiConfig.baseUrl,
    apiKey: aiConfig.apiKey || '',
    model: aiConfig.model,
  });
}
```

## UI 设计

### 按钮位置

在 AI 助手的 Header 区域，与 Settings 按钮并排：

```
┌─────────────────────────────────────────────────────────┐
│ AI 助手  [会话选择▼]           [🤖] [⚙️] [✂️] [🗑️]     │
│                              Page   设置  压缩  清空    │
│                              Agent                      │
└─────────────────────────────────────────────────────────┘
```

### 按钮样式

- 变体：`ghost`
- 图标：`Bot` (lucide-react)
- Tooltip: "Page Agent - AI 操作当前页面"

### 交互流程

```
用户点击按钮
    │
    ▼
检查 AI 配置 ─── 未配置 ──▶ Toast: "请先配置 AI 服务"
    │
   已配置
    │
    ▼
发送消息到 Background
    │
    ▼
检查当前标签页 ── 受限页面 ──▶ Toast: "无法在此页面使用"
    │
   正常页面
    │
    ▼
注入 PageAgent 到目标页面
    │
    ▼
PageAgent Panel 显示在目标页面右下角
```

### 状态反馈

| 状态 | 反馈 |
|------|------|
| 注入中 | 按钮显示 loading 状态 |
| 注入成功 | Toast: "Page Agent 已启动，请在当前页面操作" |
| 注入失败 | Toast 显示错误信息 |

## 依赖与配置

### 依赖安装

```bash
pnpm add page-agent
```

### 权限声明

```json
// manifest.json
{
  "permissions": [
    "activeTab",
    "scripting"
  ]
}
```

### WXT 配置

确保 `page-agent` 包被正确打包到 content script 中。

## 安全性

### 注入限制

以下页面类型不允许注入：

| 页面类型 | 示例 |
|---------|------|
| 浏览器内部页面 | `chrome://`, `edge://`, `about:` |
| 扩展页面 | `chrome-extension://` |
| Chrome Web Store | `https://chrome.google.com/webstore` |

### API Key 安全

- API Key 从 storage 读取，不在代码中硬编码
- 注入到页面时，配置仅在内存中传递

## 测试要点

1. **功能测试**
   - 点击按钮后 PageAgent Panel 正常显示
   - 在 Panel 中输入任务，PageAgent 正确执行
   - 复用现有 AI 配置正常工作

2. **边界测试**
   - 未配置 AI 服务时点击按钮，显示正确提示
   - 在 `chrome://` 页面点击按钮，显示正确提示
   - 注入失败时显示正确错误信息

3. **兼容性测试**
   - Chrome 浏览器正常工作
   - Firefox 浏览器正常工作（如需支持）

## 参考资源

- [Page-Agent 官方文档](https://alibaba.github.io/page-agent/docs/introduction/overview/)
- [Page-Agent GitHub](https://github.com/alibaba/page-agent)
- [Page-Agent NPM](https://www.npmjs.com/package/page-agent)