import {
  isSensitiveFieldName,
  redactSensitiveJsonObject,
  redactSensitiveText,
} from './sensitive.ts';

/** 单次采集文本上限，约 64KB。 */
export const MAX_CAPTURED_TEXT_CHARS = 64 * 1024;

export const CAPTURE_TRUNCATED_MARK = '...[truncated]';

const SENSITIVE_HEADER_NAMES = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'proxy-authorization',
]);

export function isSensitiveHeaderName(name: string): boolean {
  return SENSITIVE_HEADER_NAMES.has(name.toLowerCase()) || isSensitiveFieldName(name);
}

export function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    result[key] = isSensitiveHeaderName(key) ? '[redacted]' : value;
  }
  return result;
}

/** 读到上限后取消剩余 body，避免把超大响应整段放进内存。 */
export async function readResponseTextLimited(
  response: Response
): Promise<{ text: string; truncated: boolean }> {
  const reader = response.body?.getReader();
  if (!reader) {
    return truncateCapturedText(await response.text());
  }

  const decoder = new TextDecoder();
  let text = '';
  let truncated = false;

  try {
    while (text.length <= MAX_CAPTURED_TEXT_CHARS) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      if (text.length > MAX_CAPTURED_TEXT_CHARS) {
        truncated = true;
        text = truncateCapturedText(text).text;
        break;
      }
    }
  } finally {
    if (truncated) {
      await reader.cancel().catch(() => undefined);
    }
  }

  if (!truncated) {
    text += decoder.decode();
  }

  return { text, truncated };
}

export function truncateCapturedText(value: string): { text: string; truncated: boolean } {
  if (value.length <= MAX_CAPTURED_TEXT_CHARS) {
    return { text: value, truncated: false };
  }

  const keep = Math.max(0, MAX_CAPTURED_TEXT_CHARS - CAPTURE_TRUNCATED_MARK.length);
  return { text: `${value.slice(0, keep)}${CAPTURE_TRUNCATED_MARK}`, truncated: true };
}

function looksLikeJson(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.startsWith('{') || trimmed.startsWith('[');
}

/** 遮密钥类字段并截断超长文本，普通业务字段保留。 */
export function redactCapturedText(value: string): { text: string; truncated: boolean } {
  const redacted = looksLikeJson(value)
    ? redactSensitiveText(redactSensitiveJsonObject(value))
    : redactSensitiveText(value);
  return truncateCapturedText(redacted);
}

/** 只替换 query 里的密钥字段，路径和 hash 保持原样。 */
export function redactCapturedUrl(url: string): string {
  const hashIndex = url.indexOf('#');
  const hash = hashIndex >= 0 ? url.slice(hashIndex) : '';
  const withoutHash = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const queryIndex = withoutHash.indexOf('?');
  if (queryIndex < 0) {
    return url;
  }

  const query = withoutHash.slice(queryIndex + 1);
  return `${withoutHash.slice(0, queryIndex + 1)}${redactSensitiveText(query)}${hash}`;
}

export interface CapturedNetworkFields {
  url: string;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  requestBody?: string;
  responseBody?: string;
  streamChunks?: Array<{ data: string }>;
  error?: string;
  truncated?: boolean;
}

export function sanitizeNetworkCapture<T extends CapturedNetworkFields>(data: T): T {
  let truncated = data.truncated === true;
  const requestBody = sanitizeOptionalText(data.requestBody);
  const responseBody = sanitizeOptionalText(data.responseBody);
  const error = sanitizeOptionalText(data.error);
  const streamChunks = data.streamChunks?.map((chunk) => {
    const sanitized = redactCapturedText(chunk.data);
    if (sanitized.truncated) truncated = true;
    return { ...chunk, data: sanitized.text };
  });

  if (requestBody?.truncated || responseBody?.truncated || error?.truncated) {
    truncated = true;
  }

  return {
    ...data,
    url: redactCapturedUrl(data.url),
    ...(data.requestHeaders ? { requestHeaders: redactHeaders(data.requestHeaders) } : {}),
    ...(data.responseHeaders ? { responseHeaders: redactHeaders(data.responseHeaders) } : {}),
    ...(requestBody ? { requestBody: requestBody.text } : {}),
    ...(responseBody ? { responseBody: responseBody.text } : {}),
    ...(error ? { error: error.text } : {}),
    ...(streamChunks ? { streamChunks } : {}),
    ...(truncated ? { truncated: true } : {}),
  };
}

function sanitizeOptionalText(
  value: string | undefined
): { text: string; truncated: boolean } | undefined {
  if (value === undefined) return undefined;
  return redactCapturedText(value);
}
