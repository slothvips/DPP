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

      const result = await browser.storage.session.get('__pageAgentConfig');
      const config = result.__pageAgentConfig as PageAgentConfig | undefined;

      if (!config) {
        console.error('[DPP] PageAgent config not found');
        return;
      }

      await browser.storage.session.remove('__pageAgentConfig');

      try {
        const agent = new PageAgent({
          baseURL: config.baseUrl,
          apiKey: config.apiKey,
          model: config.model,
          language: 'zh-CN',
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
