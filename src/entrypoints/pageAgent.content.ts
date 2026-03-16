// src/entrypoints/pageAgent.content.ts
// Content Script 入口 - 注入到目标页面后初始化 PageAgent
import { PageAgent } from 'page-agent';
import { browser } from 'wxt/browser';
import type { PageAgentConfig } from '@/lib/pageAgent/types';
import { serializeHeaders } from '@/lib/pageAgent/utils';

export default defineContentScript({
  matches: [],
  runAt: 'document_start',
  main() {
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
          maxRetries: 5,
          maxSteps: 200,
          customFetch: proxyFetch,
        });

        agent.panel.show();
        window.__DPP_PAGE_AGENT__ = agent;
      } catch (error) {
        console.error(
          '[PageAgent] 初始化失败:',
          error instanceof Error ? error.message : '未知错误'
        );
      }
    }

    initPageAgent();
  },
});
