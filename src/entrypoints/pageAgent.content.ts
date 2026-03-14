// src/entrypoints/pageAgent.content.ts
// Content Script 入口 - 注入到目标页面后初始化 PageAgent
import { PageAgent } from 'page-agent';
import { browser } from 'wxt/browser';
import type { PageAgentConfig } from '@/lib/pageAgent/types';
import '@/lib/pageAgent/types';

// 导入全局类型声明

export default defineContentScript({
  matches: [],
  runAt: 'document_start',
  main() {
    async function initPageAgent() {
      if (window.__DPP_PAGE_AGENT__) {
        console.log('[DPP] PageAgent already initialized');
        return;
      }

      // 通过消息从 background 获取配置（content script 无法直接访问 storage.session）
      const response = await browser.runtime.sendMessage({ type: 'PAGE_AGENT_GET_CONFIG' });
      const config = response?.config as PageAgentConfig | undefined;

      if (!config) {
        console.error('[DPP] PageAgent config not found');
        return;
      }

      try {
        const agent = new PageAgent({
          baseURL: config.baseUrl,
          apiKey: config.apiKey,
          model: config.model,
          language: 'zh-CN',
          maxRetries: 5, // LLM 调用失败时最多重试 5 次
        });

        agent.panel.show();
        window.__DPP_PAGE_AGENT__ = agent;

        console.log('[DPP] PageAgent initialized successfully');
      } catch (error) {
        console.error('[DPP] Failed to initialize PageAgent:', error);
      }
    }

    initPageAgent();
  },
});
