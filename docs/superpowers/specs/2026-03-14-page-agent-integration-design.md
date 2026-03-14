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
│  1. 获取当前活动标签页 (query active tab)                   │
│  2. 读取 AI 配置 (storage + 解密 API Key)                   │
│  3. 通过 browser.scripting.executeScript 注入               │
└────────────────────────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────┐
│                    目标页面 (Injected Script)               │
│  1. 动态加载 page-agent IIFE (CDN)                          │
│  2. 初始化 PageAgent 实例                                   │
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
2. Background 查询当前活动标签页，读取并解密 AI 配置
3. 通过 `browser.scripting.executeScript` 注入初始化代码
4. 初始化代码从 CDN 加载 page-agent IIFE 版本
5. PageAgent 在目标页面初始化并显示 Panel
6. 用户通过 Panel 与 PageAgent 交互

## 模块设计

### 文件结构

```
src/
├── lib/
│   ├── db/
│   │   └── settings.ts         # 添加 getAIConfig() 函数
│   └── pageAgent/
│       ├── index.ts            # 导出入口
│       ├── injector.ts         # 注入逻辑
│       └── types.ts            # 类型定义
├── features/
│   └── aiAssistant/
│       └── components/
│           └── AIAssistantView.tsx  # 添加 Page Agent 按钮
└── entrypoints/
    └── background/
        ├── handlers/
        │   ├── index.ts        # 导出 pageAgent handler
        │   └── pageAgent.ts    # Page Agent 消息处理
        └── background.ts       # 添加消息路由
```

### 模块职责

| 模块 | 职责 |
|------|------|
| `settings.ts` | 新增 `getAIConfig()` 函数，读取并解密 AI 配置 |
| `injector.ts` | 封装注入逻辑：构建初始化代码、执行注入 |
| `pageAgent.ts` (background handler) | 处理注入请求，查询活动标签页，调用配置读取 |
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

### getAIConfig 函数（新增）

```typescript
// src/lib/db/settings.ts 新增函数

import { db } from '@/db';
import { decryptData, loadKey } from '@/lib/crypto/encryption';
import { DEFAULT_CONFIGS } from '@/lib/ai/provider';
import type { AIProviderType } from '@/lib/ai/types';

export interface AIConfigResult {
  provider: AIProviderType;
  baseUrl: string;
  model: string;
  apiKey: string;
}

/**
 * 获取 AI 配置（包含解密后的 API Key）
 * 复用 AIConfigDialog 中的配置读取逻辑
 */
export async function getAIConfig(): Promise<AIConfigResult | null> {
  try {
    // 1. 读取 provider 类型
    const providerSetting = await db.settings.where('key').equals('ai_provider_type').first();
    const provider = (providerSetting?.value as AIProviderType) || 'custom';

    // 2. 读取 provider 特定配置
    const baseUrlKey = `ai_${provider}_base_url`;
    const modelKey = `ai_${provider}_model`;
    const apiKeyKey = `ai_${provider}_api_key`;

    const baseUrlSetting = await db.settings.where('key').equals(baseUrlKey).first();
    const modelSetting = await db.settings.where('key').equals(modelKey).first();
    const apiKeySetting = await db.settings.where('key').equals(apiKeyKey).first();

    const baseUrl = (baseUrlSetting?.value as string) || DEFAULT_CONFIGS[provider]?.baseUrl || '';
    const model = (modelSetting?.value as string) || DEFAULT_CONFIGS[provider]?.model || '';

    // 3. 解密 API Key
    let apiKey = '';
    if (apiKeySetting?.value) {
      try {
        const encryptionKey = await loadKey();
        if (encryptionKey) {
          apiKey = (await decryptData(
            apiKeySetting.value as { ciphertext: string; iv: string },
            encryptionKey
          )) as string;
        } else {
          apiKey = apiKeySetting.value as string;
        }
      } catch {
        apiKey = '';
      }
    }

    return { provider, baseUrl, model, apiKey };
  } catch (error) {
    console.error('[getAIConfig] Failed to load config:', error);
    return null;
  }
}
```

### 注入器实现

```typescript
// src/lib/pageAgent/injector.ts

import { browser } from 'wxt/browser';
import type { PageAgentConfig } from './types';

/** Page-Agent IIFE CDN URL */
const PAGE_AGENT_CDN_URL = 'https://cdn.jsdelivr.net/npm/page-agent@1.5.6/dist/iife/page-agent.demo.js';

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
 * 检测页面是否已注入 PageAgent
 */
export async function isAlreadyInjected(tabId: number): Promise<boolean> {
  try {
    const result = await browser.scripting.executeScript({
      target: { tabId },
      func: () => !!(window as any).__DPP_PAGE_AGENT__,
    });
    return result[0]?.result === true;
  } catch {
    return false;
  }
}

/**
 * 注入 PageAgent 到指定标签页
 */
export async function injectPageAgent(
  tabId: number,
  config: PageAgentConfig
): Promise<{ success: boolean; error?: string }> {
  try {
    // 检查是否已注入
    const alreadyInjected = await isAlreadyInjected(tabId);
    if (alreadyInjected) {
      // 聚焦已存在的 Panel
      await browser.scripting.executeScript({
        target: { tabId },
        func: () => {
          const agent = (window as any).__DPP_PAGE_AGENT__;
          if (agent?.panel) {
            agent.panel.show();
            agent.panel.expand();
          }
        },
      });
      return { success: true };
    }

    // 注入初始化代码
    await browser.scripting.executeScript({
      target: { tabId },
      func: initPageAgent,
      args: [config, PAGE_AGENT_CDN_URL],
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
 * 动态加载 page-agent IIFE 并初始化
 */
function initPageAgent(config: PageAgentConfig, cdnUrl: string): void {
  // 创建 script 标签加载 IIFE
  const script = document.createElement('script');
  script.src = cdnUrl;
  script.onload = () => {
    // IIFE 加载完成后，PageAgent 挂载在 window.PageAgent
    const PageAgentClass = (window as any).PageAgent;
    if (!PageAgentClass) {
      console.error('[DPP] PageAgent not found after script load');
      return;
    }

    // 初始化实例
    const agent = new PageAgentClass({
      baseURL: config.baseUrl,
      apiKey: config.apiKey,
      model: config.model,
      language: 'zh-CN',
    });

    // 显示 Panel
    agent.panel.show();

    // 挂载到 window 以便调试和重复检测
    (window as any).__DPP_PAGE_AGENT__ = agent;

    console.log('[DPP] PageAgent initialized successfully');
  };
  script.onerror = () => {
    console.error('[DPP] Failed to load PageAgent script');
  };

  document.head.appendChild(script);
}
```

### Background Handler

```typescript
// src/entrypoints/background/handlers/pageAgent.ts

import { injectPageAgent, isInjectable } from '@/lib/pageAgent/injector';
import { getAIConfig } from '@/lib/db/settings';
import type { PageAgentInjectRequest, PageAgentInjectResponse } from '@/lib/pageAgent/types';
import { browser } from 'wxt/browser';

export async function handlePageAgentInject(
  request: PageAgentInjectRequest
): Promise<PageAgentInjectResponse> {
  // 1. 查询当前活动标签页
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const activeTab = tabs[0];

  if (!activeTab?.id || !activeTab.url) {
    return { success: false, error: '无法获取当前标签页' };
  }

  // 2. 检查页面是否可注入
  if (!isInjectable(activeTab.url)) {
    return { success: false, error: '无法在此页面使用 Page Agent' };
  }

  // 3. 读取 AI 配置（包含解密）
  const aiConfig = await getAIConfig();

  if (!aiConfig) {
    return { success: false, error: '请先配置 AI 服务' };
  }

  if (!aiConfig.apiKey && aiConfig.provider !== 'webllm') {
    return { success: false, error: '请先配置 API Key' };
  }

  // 4. 注入 PageAgent
  return injectPageAgent(activeTab.id, {
    baseUrl: aiConfig.baseUrl,
    apiKey: aiConfig.apiKey || '',
    model: aiConfig.model,
  });
}
```

### Handler 导出

```typescript
// src/entrypoints/background/handlers/index.ts 新增

export { handlePageAgentInject } from './pageAgent';
export type { PageAgentInjectRequest, PageAgentInjectResponse } from '@/lib/pageAgent/types';
```

### Background 消息路由

```typescript
// src/entrypoints/background.ts 新增路由

import { handlePageAgentInject } from './handlers';

// 在消息监听器中添加
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // ... 现有路由代码 ...

  // Page Agent 注入
  if (message.type === 'PAGE_AGENT_INJECT') {
    (async () => {
      const response = await handlePageAgentInject(message);
      sendResponse(response);
    })();
    return true; // 保持消息通道开放
  }

  // ... 其他路由 ...
});
```

## UI 设计

### 按钮位置

在 AI 助手的 Header 区域，位于 Settings 按钮之前：

```
┌─────────────────────────────────────────────────────────┐
│ AI 助手  [会话选择▼]           [🤖] [⚙️] [✂️] [🗑️]     │
│                              Page   设置  压缩  清空    │
│                              Agent                      │
└─────────────────────────────────────────────────────────┘
```

### 按钮实现

```tsx
// AIAssistantView.tsx Header 区域新增按钮

import { Bot } from 'lucide-react';
import { browser } from 'wxt/browser';

// 按钮状态
const [isInjecting, setIsInjecting] = useState(false);

// 注入处理函数
const handlePageAgentInject = async () => {
  setIsInjecting(true);
  try {
    const response = await browser.runtime.sendMessage({ type: 'PAGE_AGENT_INJECT' });
    if (response.success) {
      toast('Page Agent 已启动，请在当前页面操作', 'success');
    } else {
      toast(response.error || '启动失败', 'error');
    }
  } catch (error) {
    toast('启动失败', 'error');
  } finally {
    setIsInjecting(false);
  }
};

// 按钮 JSX
<Button
  variant="ghost"
  size="sm"
  onClick={handlePageAgentInject}
  disabled={isInjecting || status === 'loading' || status === 'streaming'}
  title="Page Agent - AI 操作当前页面"
  data-testid="page-agent-button"
>
  {isInjecting ? (
    <Loader2 className="w-4 h-4 animate-spin" />
  ) : (
    <Bot className="w-4 h-4" />
  )}
</Button>
```

### 按钮样式

- 变体：`ghost`
- 图标：`Bot` (lucide-react)
- Loading 状态：使用 `Loader2` 图标 + `animate-spin`
- Tooltip: "Page Agent - AI 操作当前页面"
- **TestId**: `page-agent-button`

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
按钮显示 Loading 状态
    │
    ▼
发送消息到 Background
    │
    ▼
Background 查询活动标签页
    │
    ▼
检查页面是否可注入 ── 受限页面 ──▶ Toast: "无法在此页面使用"
    │
   可注入
    │
    ▼
检查是否已注入 ── 已注入 ──▶ 聚焦现有 Panel
    │
   未注入
    │
    ▼
注入初始化代码
    │
    ▼
从 CDN 加载 page-agent IIFE
    │
    ▼
初始化 PageAgent 并显示 Panel
```

### 状态反馈

| 状态 | 反馈 |
|------|------|
| 注入中 | 按钮显示 loading 动画 |
| 注入成功 | Toast: "Page Agent 已启动，请在当前页面操作" |
| 注入失败 | Toast 显示错误信息 |
| 已存在实例 | Toast: "Page Agent 已启动，请在当前页面操作" (聚焦现有 Panel) |

## 依赖与配置

### 权限声明

在 `wxt.config.ts` 中添加权限：

```typescript
// wxt.config.ts
export default defineConfig({
  // ... 现有配置
  manifest: {
    permissions: [
      'storage',
      'sidePanel',
      'alarms',
      'activeTab',   // 新增：访问活动标签页
      'scripting',   // 新增：脚本注入
    ],
  },
});
```

### 无需安装 npm 包

使用 CDN 加载 IIFE 版本，无需安装 `page-agent` npm 包。

## 安全性

### 注入限制

以下页面类型不允许注入：

| 页面类型 | 示例 |
|---------|------|
| 浏览器内部页面 | `chrome://`, `edge://`, `about:` |
| 扩展页面 | `chrome-extension://` |
| Chrome Web Store | `https://chrome.google.com/webstore` |

### API Key 安全

- API Key 存储时已加密
- 读取时通过 `decryptData` 解密
- 解密后的 Key 仅在内存中传递，不持久化
- 注入到页面后，配置存在于目标页面的 JavaScript 上下文中

### 重复注入处理

- 检测 `window.__DPP_PAGE_AGENT__` 是否存在
- 已存在时聚焦现有 Panel 而非重新创建实例

## 测试要点

### 功能测试

| 测试项 | 预期结果 |
|-------|---------|
| 点击按钮后 PageAgent Panel 正常显示 | Panel 显示在页面右下角 |
| 在 Panel 中输入任务执行 | PageAgent 正确操作页面元素 |
| 复用现有 AI 配置正常工作 | 使用已配置的 provider/model/apiKey |
| 重复点击按钮 | 聚焦现有 Panel，不重复注入 |

### 边界测试

| 测试项 | 预期结果 |
|-------|---------|
| 未配置 AI 服务时点击按钮 | Toast: "请先配置 AI 服务" |
| 在 `chrome://` 页面点击按钮 | Toast: "无法在此页面使用 Page Agent" |
| 在扩展页面点击按钮 | Toast: "无法在此页面使用 Page Agent" |
| CDN 加载失败 | 控制台错误日志，Toast: "启动失败" |

### 兼容性测试

| 浏览器 | 状态 |
|-------|------|
| Chrome | ✅ 支持 |
| Firefox | ✅ 支持（使用 `browser` API） |
| Edge | ✅ 支持 |

## 参考资源

- [Page-Agent 官方文档](https://alibaba.github.io/page-agent/docs/introduction/overview/)
- [Page-Agent GitHub](https://github.com/alibaba/page-agent)
- [Page-Agent NPM](https://www.npmjs.com/package/page-agent)
- [Page-Agent IIFE CDN](https://cdn.jsdelivr.net/npm/page-agent@1.5.6/dist/iife/page-agent.demo.js)