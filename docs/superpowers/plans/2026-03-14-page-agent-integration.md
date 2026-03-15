# Page-Agent 集成实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 page-agent npm 包集成到 DPP 浏览器扩展，在 AI 助手中添加按钮实现 AI 驱动的页面自动化。

**Architecture:** 用户点击按钮 → Background 读取配置 → 注入 Content Script → Content Script 初始化 PageAgent 并显示 Panel

**Tech Stack:** TypeScript, WXT, page-agent npm 包, browser.scripting API

**Spec:** `docs/superpowers/specs/2026-03-14-page-agent-integration-design.md`

---

## Chunk 1: 基础设施与类型定义

### Task 1: 安装 page-agent 依赖

**Files:**

- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: 安装 page-agent 包**

Run: `pnpm add page-agent`
Expected: package.json 中添加 page-agent 依赖

- [ ] **Step 2: 验证安装成功**

Run: `grep -q "page-agent" package.json && echo "OK"`
Expected: 输出 "OK"

- [ ] **Step 3: 提交依赖变更**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add page-agent dependency"
```

---

### Task 2: 创建类型定义文件

**Files:**

- Create: `src/lib/pageAgent/types.ts`

- [ ] **Step 1: 创建 types.ts 文件**

```typescript
// src/lib/pageAgent/types.ts
// Page-Agent 集成类型定义

/**
 * PageAgent 初始化配置
 */
export interface PageAgentConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

/**
 * 注入请求消息
 */
export interface PageAgentInjectRequest {
  type: 'PAGE_AGENT_INJECT';
}

/**
 * 注入响应
 */
export interface PageAgentInjectResponse {
  success: boolean;
  error?: string;
}
```

- [ ] **Step 2: 验证类型检查通过**

Run: `pnpm compile`
Expected: 无错误

- [ ] **Step 3: 提交类型定义**

```bash
git add src/lib/pageAgent/types.ts
git commit -m "feat(pageAgent): add type definitions"
```

---

### Task 3: 创建导出入口文件

**Files:**

- Create: `src/lib/pageAgent/index.ts`

- [ ] **Step 1: 创建 index.ts 文件**

```typescript
// src/lib/pageAgent/index.ts
// Page-Agent 模块导出入口

export * from './types';
export * from './injector';
```

- [ ] **Step 2: 验证类型检查通过**

Run: `pnpm compile`
Expected: 无错误（injector.ts 尚不存在，先跳过）

- [ ] **Step 3: 暂不提交（等 injector.ts 创建后一起提交）**

---

## Chunk 2: 核心功能实现

### Task 4: 添加 getAIConfig 函数到 settings.ts

**Files:**

- Modify: `src/lib/db/settings.ts`

- [ ] **Step 1: 添加必要的导入**

在文件顶部添加：

```typescript
import { DEFAULT_CONFIGS } from '@/lib/ai/provider';
import type { AIProviderType } from '@/lib/ai/types';
import { decryptData, loadKey } from '@/lib/crypto/encryption';
```

- [ ] **Step 2: 添加 AIConfigResult 接口**

在导入语句后添加：

```typescript
/**
 * AI 配置结果（包含解密后的 API Key）
 */
export interface AIConfigResult {
  provider: AIProviderType;
  baseUrl: string;
  model: string;
  apiKey: string;
}
```

- [ ] **Step 3: 添加 getAIConfig 函数**

在文件末尾添加：

```typescript
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

- [ ] **Step 4: 验证类型检查通过**

Run: `pnpm compile`
Expected: 无错误

- [ ] **Step 5: 提交配置读取函数**

```bash
git add src/lib/db/settings.ts
git commit -m "feat(settings): add getAIConfig function with decryption"
```

---

### Task 5: 创建注入器模块

**Files:**

- Create: `src/lib/pageAgent/injector.ts`

- [ ] **Step 1: 创建 injector.ts 文件**

```typescript
// src/lib/pageAgent/injector.ts
// PageAgent 注入逻辑
import { browser } from 'wxt/browser';
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
  return !blockedPrefixes.some((prefix) => url.startsWith(prefix));
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
 * 聚焦已存在的 PageAgent Panel
 */
export async function focusExistingPanel(tabId: number): Promise<void> {
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
}

/**
 * 注入 PageAgent 到指定标签页
 * 使用 WXT 打包的 content script 文件
 */
export async function injectPageAgent(
  tabId: number,
  config: PageAgentConfig
): Promise<{ success: boolean; error?: string }> {
  try {
    // 检查是否已注入
    const alreadyInjected = await isAlreadyInjected(tabId);
    if (alreadyInjected) {
      await focusExistingPanel(tabId);
      return { success: true };
    }

    // 通过 storage 传递配置给 content script
    // 使用 session storage 避免持久化敏感信息
    await browser.storage.session.set({ __pageAgentConfig: config });

    // 注入打包后的 content script
    await browser.scripting.executeScript({
      target: { tabId },
      files: ['/content-scripts/pageAgent.js'],
    });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '注入失败',
    };
  }
}
```

- [ ] **Step 2: 验证类型检查通过**

Run: `pnpm compile`
Expected: 无错误

- [ ] **Step 3: 提交注入器模块**

```bash
git add src/lib/pageAgent/injector.ts src/lib/pageAgent/index.ts
git commit -m "feat(pageAgent): add injector module"
```

---

### Task 6: 创建 Content Script 入口

**Files:**

- Create: `src/entrypoints/pageAgent.content.ts`

- [ ] **Step 1: 创建 pageAgent.content.ts 文件**

```typescript
// src/entrypoints/pageAgent.content.ts
// Content Script 入口 - 注入到目标页面后初始化 PageAgent
// 注意：此 content script 通过 scripting.executeScript 手动注入，不会自动注入到所有页面
import { PageAgent } from 'page-agent';
import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/sandbox';

interface PageAgentConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export default defineContentScript({
  // matches 设置为空数组，因为我们通过 scripting API 手动注入
  // 但 WXT 要求必须有 matches，所以设置一个不会匹配的模式
  matches: [],
  runAt: 'document_start',
  main() {
    /**
     * Content Script 入口
     * 注入到目标页面后初始化 PageAgent
     */
    async function initPageAgent() {
      // 检查是否已初始化
      if ((window as any).__DPP_PAGE_AGENT__) {
        console.log('[DPP] PageAgent already initialized');
        return;
      }

      // 从 session storage 读取配置
      const result = await browser.storage.session.get('__pageAgentConfig');
      const config = result.__pageAgentConfig as PageAgentConfig | undefined;

      if (!config) {
        console.error('[DPP] PageAgent config not found');
        return;
      }

      // 清除 session storage 中的配置
      await browser.storage.session.remove('__pageAgentConfig');

      try {
        // 初始化 PageAgent
        const agent = new PageAgent({
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
      } catch (error) {
        console.error('[DPP] Failed to initialize PageAgent:', error);
      }
    }

    initPageAgent();
  },
});
```

- [ ] **Step 2: 验证类型检查通过**

Run: `pnpm compile`
Expected: 无错误

- [ ] **Step 3: 提交 Content Script 入口**

```bash
git add src/entrypoints/pageAgent.content.ts
git commit -m "feat(pageAgent): add content script entry with defineContentScript"
```

---

## Chunk 3: Background 处理与消息路由

### Task 7: 创建 Background Handler

**Files:**

- Create: `src/entrypoints/background/handlers/pageAgent.ts`

- [ ] **Step 1: 创建 pageAgent.ts 文件**

```typescript
// src/entrypoints/background/handlers/pageAgent.ts
// PageAgent 注入请求处理器
import { browser } from 'wxt/browser';
import { getAIConfig } from '@/lib/db/settings';
import { injectPageAgent, isInjectable } from '@/lib/pageAgent/injector';
import type { PageAgentInjectRequest, PageAgentInjectResponse } from '@/lib/pageAgent/types';

/**
 * 处理 PageAgent 注入请求
 */
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

- [ ] **Step 2: 验证类型检查通过**

Run: `pnpm compile`
Expected: 无错误

- [ ] **Step 3: 提交 Background Handler**

```bash
git add src/entrypoints/background/handlers/pageAgent.ts
git commit -m "feat(pageAgent): add background handler"
```

---

### Task 8: 更新 handlers/index.ts 导出

**Files:**

- Modify: `src/entrypoints/background/handlers/index.ts`

- [ ] **Step 1: 添加 pageAgent 导出**

在文件末尾添加：

```typescript
export { handlePageAgentInject } from './pageAgent';
export type { PageAgentInjectRequest, PageAgentInjectResponse } from '@/lib/pageAgent/types';
```

- [ ] **Step 2: 验证类型检查通过**

Run: `pnpm compile`
Expected: 无错误

- [ ] **Step 3: 提交导出更新**

```bash
git add src/entrypoints/background/handlers/index.ts
git commit -m "feat(pageAgent): export handler from index"
```

---

### Task 9: 更新 Background 消息路由

**Files:**

- Modify: `src/entrypoints/background.ts`

- [ ] **Step 1: 添加 handlePageAgentInject 导入**

修改导入语句（第7-15行），添加 `handlePageAgentInject`：

```typescript
import {
  handleJenkinsMessage,
  handlePageAgentInject,
  handleProxyMessage,
  handleRecorderMessage,
  handleRemoteRecordingMessage,
  handleSyncMessage,
  setupAutoSync,
  setupOmnibox,
} from './background/handlers';
```

- [ ] **Step 2: 添加 PageAgent 消息路由**

在消息监听器中（约第130行 `// Open side panel request` 之前）添加：

```typescript
    // Page Agent 注入
    if (message.type === 'PAGE_AGENT_INJECT') {
      (async () => {
        const response = await handlePageAgentInject(message);
        sendResponse(response);
      })();
      return true;
    }
```

- [ ] **Step 3: 验证类型检查通过**

Run: `pnpm compile`
Expected: 无错误

- [ ] **Step 4: 提交消息路由更新**

```bash
git add src/entrypoints/background.ts
git commit -m "feat(pageAgent): add message routing in background"
```

---

## Chunk 4: 配置与 UI

### Task 10: 更新 WXT 配置添加权限

**Files:**

- Modify: `wxt.config.ts`

- [ ] **Step 1: 添加 activeTab 和 scripting 权限**

修改 `manifest.permissions` 数组（第51行）：

```typescript
    permissions: ['storage', 'sidePanel', 'alarms', 'activeTab', 'scripting'],
```

- [ ] **Step 2: 添加 content script 到 web_accessible_resources**

修改 `manifest.web_accessible_resources`（第65-70行），添加 pageAgent.js：

```typescript
    web_accessible_resources: [
      {
        resources: ['network-interceptor.js', 'console-interceptor.js', 'content-scripts/pageAgent.js'],
        matches: ['<all_urls>'],
      },
    ],
```

- [ ] **Step 3: 验证配置正确**

Run: `pnpm compile`
Expected: 无错误

- [ ] **Step 4: 提交配置更新**

```bash
git add wxt.config.ts
git commit -m "feat(pageAgent): add activeTab and scripting permissions"
```

---

### Task 11: 添加 UI 按钮到 AIAssistantView

**Files:**

- Modify: `src/features/aiAssistant/components/AIAssistantView.tsx`

- [ ] **Step 1: 添加必要的导入**

在文件顶部的导入区域添加：

```typescript
import { Bot, Loader2 } from 'lucide-react';
import { browser } from 'wxt/browser';
```

- [ ] **Step 2: 添加状态变量**

在组件内的 state 定义区域（约第44-49行附近）添加：

```typescript
const [isInjecting, setIsInjecting] = useState(false);
```

- [ ] **Step 3: 添加注入处理函数**

在 `handleSummarize` 函数之后添加：

```typescript
const handlePageAgentInject = useCallback(async () => {
  if (isInjecting) return;

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
}, [isInjecting, toast]);
```

- [ ] **Step 4: 添加按钮到 Header**

在 Settings 按钮之前（约第160行）添加 Page Agent 按钮：

```tsx
<Button
  variant="ghost"
  size="sm"
  onClick={handlePageAgentInject}
  disabled={isInjecting || status === 'loading' || status === 'streaming'}
  title="Page Agent - AI 操作当前页面"
  data-testid="page-agent-button"
>
  {isInjecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
</Button>
```

- [ ] **Step 5: 验证类型检查通过**

Run: `pnpm compile`
Expected: 无错误

- [ ] **Step 6: 提交 UI 更新**

```bash
git add src/features/aiAssistant/components/AIAssistantView.tsx
git commit -m "feat(pageAgent): add Page Agent button to AI Assistant"
```

---

## Chunk 5: 构建与验证

### Task 12: 构建验证

**Files:**

- 无文件修改

- [ ] **Step 1: 运行开发构建**

Run: `pnpm dev`
Expected: 构建成功，无错误

- [ ] **Step 2: 验证 Content Script 打包**

检查 `.output/chrome-mv3/content-scripts/` 目录下是否有 `pageAgent.js` 文件

Run: `ls .output/chrome-mv3/content-scripts/ 2>/dev/null || echo "Build first"`
Expected: 看到 pageAgent.js 或类似文件

- [ ] **Step 3: 运行生产构建**

Run: `pnpm build`
Expected: 构建成功

- [ ] **Step 4: 运行 lint 检查**

Run: `pnpm lint`
Expected: 无错误或警告

- [ ] **Step 5: 提交最终验证**

```bash
git add -A
git commit -m "chore: verify page-agent integration build"
```

---

## 任务完成检查清单

- [ ] 所有代码已提交
- [ ] `pnpm compile` 无错误
- [ ] `pnpm lint` 无错误
- [ ] `pnpm build` 成功
- [ ] Content Script 打包正确（生成 pageAgent.js）
- [ ] 权限已添加到 manifest
- [ ] UI 按钮显示正确

---

## 后续测试建议

1. 在浏览器中加载扩展
2. 配置 AI 服务（Settings → AI 设置）
3. 打开任意网页
4. 点击 AI 助手中的 Page Agent 按钮
5. 验证 PageAgent Panel 显示在页面右下角
6. 在 Panel 中输入任务测试功能
