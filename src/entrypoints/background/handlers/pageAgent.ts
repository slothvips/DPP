// src/entrypoints/background/handlers/pageAgent.ts
// PageAgent 注入请求处理器
import { browser } from 'wxt/browser';
import { getAIConfig } from '@/lib/db/settings';
import { injectPageAgent, isInjectable } from '@/lib/pageAgent/injector';
import type { PageAgentInjectRequest, PageAgentInjectResponse } from '@/lib/pageAgent/types';

export async function handlePageAgentInject(
  _request: PageAgentInjectRequest
): Promise<PageAgentInjectResponse> {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const activeTab = tabs[0];

  if (!activeTab?.id || !activeTab.url) {
    return { success: false, error: '无法获取当前标签页' };
  }

  if (!isInjectable(activeTab.url)) {
    return { success: false, error: '无法在此页面使用 Page Agent' };
  }

  const aiConfig = await getAIConfig();

  if (!aiConfig) {
    return { success: false, error: '请先配置 AI 服务' };
  }

  if (!aiConfig.apiKey && aiConfig.provider !== 'webllm') {
    return { success: false, error: '请先配置 API Key' };
  }

  return injectPageAgent(activeTab.id, {
    baseUrl: aiConfig.baseUrl,
    apiKey: aiConfig.apiKey || '',
    model: aiConfig.model,
  });
}
