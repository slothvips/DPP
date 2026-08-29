const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

function parseJenkinsUrl(value: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('Jenkins URL 格式无效');
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new Error('Jenkins URL 仅支持 HTTP 或 HTTPS');
  }
  if (parsed.username || parsed.password) {
    throw new Error('Jenkins URL 不允许包含用户名或密码');
  }
  return parsed;
}

export function normalizeJenkinsRootUrl(value: string): string {
  const parsed = parseJenkinsUrl(value);
  parsed.hash = '';
  parsed.search = '';
  parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
  return parsed.href.replace(/\/$/, '');
}

export function assertJenkinsUrlAllowed(value: string, rootUrl: string): string {
  const target = parseJenkinsUrl(value);
  const root = parseJenkinsUrl(rootUrl);
  if (target.origin !== root.origin) {
    throw new Error('Jenkins 请求地址与所选环境不属于同一来源');
  }
  target.hash = '';
  return target.href;
}
