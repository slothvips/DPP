export function parseBrowserTaskArguments(raw: string, toolName: string): Record<string, string> {
  const parsed: unknown = JSON.parse(raw || '{}');
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`工具 ${toolName} 参数无效`);
  }
  return Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, String(value)]));
}

export function areBrowserUrlsEqual(left: string, right: string): boolean {
  try {
    return new URL(left).href === new URL(right).href;
  } catch {
    return left === right;
  }
}
