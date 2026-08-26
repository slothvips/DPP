import {
  handlePageAgentLlmAbort,
  handlePageAgentLlmRequest,
} from '@/entrypoints/background/handlers/pageAgentLlm';
import type { PageAgentLlmAbortMessage, PageAgentLlmRequestMessage } from './multiPageTypes';
import { serializeHeaders } from './utils';

interface BridgeResponse {
  success: boolean;
  ok?: boolean;
  status?: number;
  statusText?: string;
  headers?: HeadersInit;
  body?: unknown;
  error?: string;
}

export async function pageAgentProxyFetch(
  input: RequestInfo | URL,
  options?: RequestInit,
  taskId = 'unknown'
): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const requestId = crypto.randomUUID();
  const request: PageAgentLlmRequestMessage = {
    type: 'PAGE_AGENT_LLM_REQUEST',
    requestId,
    taskId,
    body:
      typeof options?.body === 'string'
        ? options.body
        : JSON.stringify({
            url,
            method: options?.method,
            headers: serializeHeaders(options?.headers),
          }),
  };
  const completion = handlePageAgentLlmRequest(request) as Promise<BridgeResponse>;
  const signal = options?.signal;
  let onAbort: (() => void) | undefined;
  const response = signal
    ? await Promise.race([
        completion,
        new Promise<never>((_, reject) => {
          onAbort = () => {
            const abort: PageAgentLlmAbortMessage = {
              type: 'PAGE_AGENT_LLM_ABORT',
              requestId,
              taskId,
            };
            handlePageAgentLlmAbort(abort);
            reject(new DOMException('PageAgent request aborted', 'AbortError'));
          };
          if (signal.aborted) onAbort();
          else signal.addEventListener('abort', onAbort, { once: true });
        }),
      ]).finally(() => {
        if (onAbort) signal.removeEventListener('abort', onAbort);
      })
    : await completion;
  if (!response.success)
    return new Response(JSON.stringify({ error: { message: response.error || '模型请求失败' } }), {
      status: response.status || 502,
    });
  return new Response(JSON.stringify(response.body), {
    status: response.status || 200,
    statusText: response.statusText,
    headers: response.headers,
  });
}
