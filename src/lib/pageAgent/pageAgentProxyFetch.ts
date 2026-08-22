import { browser } from 'wxt/browser';
import type { PageAgentLlmRequestMessage } from './multiPageTypes';
import { serializeHeaders } from './utils';

type PageAgentLlmResponse =
  | {
      success: true;
      ok: boolean;
      status: number;
      statusText: string;
      headers: HeadersInit;
      body: unknown;
    }
  | { success: false; error?: string; status?: number };

export async function pageAgentProxyFetch(
  input: RequestInfo | URL,
  options?: RequestInit,
  taskId = 'unknown'
): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const signal = options?.signal;
  const requestId = crypto.randomUUID();
  const body = typeof options?.body === 'string' ? options.body : undefined;
  const request: PageAgentLlmRequestMessage = {
    type: 'PAGE_AGENT_LLM_REQUEST',
    requestId,
    taskId,
    body:
      body ||
      JSON.stringify({ url, method: options?.method, headers: serializeHeaders(options?.headers) }),
  };
  const completion = browser.runtime.sendMessage(
    request
  ) as unknown as Promise<PageAgentLlmResponse>;
  let abortHandler: (() => void) | undefined;

  const response = signal
    ? await Promise.race([
        completion,
        new Promise<never>((_, reject) => {
          abortHandler = () => {
            void browser.runtime
              .sendMessage({
                type: 'PAGE_AGENT_LLM_ABORT',
                requestId,
                taskId,
              })
              .catch(() => undefined);
            reject(new DOMException('PageAgent request aborted', 'AbortError'));
          };
          if (signal.aborted) {
            abortHandler();
          } else {
            signal.addEventListener('abort', abortHandler, { once: true });
          }
        }),
      ]).finally(() => {
        if (abortHandler) signal.removeEventListener('abort', abortHandler);
      })
    : await completion;

  if (response.success !== true) {
    const message = response.error || 'PageAgent 模型请求失败';
    return new Response(JSON.stringify({ error: { message } }), {
      status: response.status || 502,
      statusText: 'PageAgent LLM Bridge Error',
      headers: { 'content-type': 'application/json' },
    });
  }

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
