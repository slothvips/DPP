import { JenkinsApiError } from './contracts.ts';

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

function parseJenkinsUrl(value: string): URL {
  if (/%(?:2e|2f|5c)/i.test(value)) {
    throw new Error('Jenkins URL 不允许包含编码后的路径逃逸字符');
  }

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
  const rootPath = root.pathname.replace(/\/+$/, '') || '/';
  const targetPath = target.pathname.replace(/\/+$/, '') || '/';
  if (rootPath !== '/' && targetPath !== rootPath && !targetPath.startsWith(`${rootPath}/`)) {
    throw new Error('Jenkins 请求地址超出所选环境的根路径');
  }
  target.hash = '';
  return target.href;
}

export function createJenkinsArtifactUrl(
  buildUrl: string,
  relativePath: string,
  rootUrl: string
): string {
  const normalizedBuildUrl = assertJenkinsUrlAllowed(buildUrl, rootUrl).replace(/\/$/, '');
  const build = new URL(normalizedBuildUrl);
  if (build.search) throw new Error('Jenkins 产物必须属于有效构建');
  const buildNumber = build.pathname.split('/').filter(Boolean).at(-1);
  if (!buildNumber || !/^\d+$/.test(buildNumber)) {
    throw new Error('Jenkins 产物必须属于有效构建');
  }
  if (
    !relativePath ||
    relativePath.startsWith('/') ||
    relativePath.includes('\\') ||
    relativePath.includes('?') ||
    relativePath.includes('#')
  ) {
    throw new Error('Jenkins 产物路径无效');
  }
  const segments = relativePath.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new Error('Jenkins 产物路径无效');
  }

  const artifactUrl = `${normalizedBuildUrl}/artifact/${segments.map(encodeURIComponent).join('/')}`;
  return assertJenkinsUrlAllowed(artifactUrl, rootUrl);
}

export function assertJenkinsRedirectAllowed(
  response: Response,
  requestUrl: string,
  rootUrl: string
): void {
  if (response.status < 300 || response.status >= 400) return;
  const location = response.headers.get('Location');
  if (!location) throw new JenkinsApiError('invalid_response', 'Jenkins 重定向缺少目标地址');
  try {
    assertJenkinsUrlAllowed(new URL(location, requestUrl).href, rootUrl);
  } catch (error) {
    throw new JenkinsApiError(
      'invalid_response',
      error instanceof Error ? `Jenkins 重定向无效: ${error.message}` : 'Jenkins 重定向无效'
    );
  }
}
