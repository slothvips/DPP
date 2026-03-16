// src/lib/pageAgent/utils.ts
// PageAgent 共享工具函数

/**
 * 将各种格式的 headers 转换为 Record<string, string>
 */
export function serializeHeaders(
  headers: Headers | Record<string, string> | [string, string][] | undefined
): Record<string, string> {
  const result: Record<string, string> = {};
  if (!headers) return result;

  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      result[key] = value;
    });
  } else if (Array.isArray(headers)) {
    for (const [key, value] of headers) {
      result[key] = value;
    }
  } else if (typeof headers === 'object') {
    for (const [key, value] of Object.entries(headers)) {
      result[key] = String(value);
    }
  }

  return result;
}
