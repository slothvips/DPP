/**
 * OpenAI 兼容接口响应的诊断工具（纯函数、零依赖，便于单测）。
 *
 * 部分 OpenAI 兼容服务在配额、限流或参数问题时仍返回 HTTP 200，
 * 响应体不含 choices（如 {"error":{"code":"1113","message":"Insufficient balance"}}），
 * 调用方在解析前必须能用这里的方法把真实原因提取出来抛给上层。
 */

/** 提取 200 状态下错误载荷里的可读信息（error.message / error / message），否则返回响应体片段 */
export function describeOpenAIResponseBody(response: unknown): string {
  const providerMessage = extractProviderErrorMessage(response);
  if (providerMessage) return providerMessage;
  try {
    return JSON.stringify(response)?.slice(0, 300) || '(空响应)';
  } catch {
    return String(response).slice(0, 300);
  }
}

function extractProviderErrorMessage(response: unknown): string | undefined {
  if (typeof response !== 'object' || response === null) return undefined;
  const record = response as Record<string, unknown>;
  const error = record.error;
  if (typeof error === 'string' && error.trim()) return error.trim().slice(0, 300);
  if (typeof error === 'object' && error !== null) {
    const message = (error as Record<string, unknown>).message;
    if (typeof message === 'string' && message.trim()) return message.trim().slice(0, 300);
  }
  if (typeof record.message === 'string' && record.message.trim()) {
    return record.message.trim().slice(0, 300);
  }
  return undefined;
}
