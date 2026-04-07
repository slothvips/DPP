// src/entrypoints/pageAgent.content.ts
// Content Script 入口 - 注入到目标页面后初始化 PageAgent
import { PageAgent } from 'page-agent';
import { browser } from 'wxt/browser';
import type { PageAgentConfig, PageAgentInstance } from '@/lib/pageAgent/types';
import { serializeHeaders } from '@/lib/pageAgent/utils';
import { logger } from '@/utils/logger';

export default defineContentScript({
  // 此脚本通过 browser.scripting.executeScript 动态注入
  // 使用一个永远不会匹配的 pattern 来避免自动注入
  matches: ['https://page-agent-manual-inject.invalid/*'],
  runAt: 'document_idle',
  main() {
    // 保存 agent 实例引用，用于在页面卸载时停止
    let currentAgent: PageAgentInstance | null = null;

    /**
     * 页面卸载时停止 PageAgent，避免继续重试
     */
    function handlePageUnload() {
      if (currentAgent) {
        logger.info('[PageAgent] 页面即将卸载，停止 Agent');
        currentAgent.stop();
        currentAgent = null;
      }
    }

    // 监听页面卸载，并在 cleanup 时移除监听器
    window.addEventListener('beforeunload', handlePageUnload);

    async function proxyFetch(input: RequestInfo | URL, options?: RequestInit): Promise<Response> {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : (input as Request).url;

      const serializedHeaders = serializeHeaders(options?.headers);

      const response = await browser.runtime.sendMessage({
        type: 'PAGE_AGENT_FETCH',
        url,
        options: {
          method: options?.method,
          headers: serializedHeaders,
          body: options?.body,
        },
      });

      if (!response || response.success !== true) {
        throw new Error(response?.error || 'Proxy fetch failed');
      }

      // 注意：这是 Response 的部分实现，仅支持 json() 和 text() 方法
      // Page Agent 当前只使用 json()，如需完整实现可添加 arrayBuffer、blob 等
      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: new Headers(response.headers),
        json: async () => response.body,
        text: async () =>
          typeof response.body === 'string' ? response.body : JSON.stringify(response.body),
      } as Response;
    }

    async function initPageAgent() {
      const existing = window.__DPP_PAGE_AGENT__;

      if (existing?.panel?.wrapper && document.body.contains(existing.panel.wrapper)) {
        existing.panel.show();
        existing.panel.expand();
        currentAgent = existing;
        return;
      }

      if (existing) {
        delete window.__DPP_PAGE_AGENT__;
      }

      const response = await browser.runtime.sendMessage({ type: 'PAGE_AGENT_GET_CONFIG' });
      const config = response?.config as PageAgentConfig | undefined;

      if (!config) {
        return;
      }

      try {
        const agent = new PageAgent({
          baseURL: config.baseUrl,
          apiKey: config.apiKey,
          model: config.model,
          language: 'zh-CN',
          maxRetries: 0, // 禁用自动重试，由我们控制何时停止
          maxSteps: 200,
          customFetch: proxyFetch,
        });

        // 确保 panel.show() 之后才设置全局引用
        agent.panel.show();
        window.__DPP_PAGE_AGENT__ = agent;
        currentAgent = agent;
      } catch (_error) {
        // 清理可能的部分初始化状态
        delete window.__DPP_PAGE_AGENT__;
        currentAgent = null;
      }
    }

    initPageAgent();

    // Content script 卸载时清理
    return () => {
      window.removeEventListener('beforeunload', handlePageUnload);
      if (currentAgent) {
        currentAgent.stop();
        currentAgent = null;
      }
      delete window.__DPP_PAGE_AGENT__;
    };
  },
});
