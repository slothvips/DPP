// src/entrypoints/pageAgent.content.ts
// Content Script 入口 - 注入到目标页面后初始化 PageAgent
import { PageAgent } from 'page-agent';

interface PageAgentConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

/**
 * PageAgent 实例接口
 */
interface PageAgentInstance {
  panel?: {
    show: () => void;
    expand: () => void;
  };
}

/**
 * 扩展 Window 接口
 */
declare global {
  interface Window {
    __DPP_PAGE_AGENT__?: PageAgentInstance;
  }
}

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
