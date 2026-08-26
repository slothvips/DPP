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
    for (const [key, value] of headers) result[key] = value;
  } else {
    for (const [key, value] of Object.entries(headers)) result[key] = String(value);
  }
  return result;
}

export function isInjectable(url: string): boolean {
  return /^https?:\/\//.test(url);
}
