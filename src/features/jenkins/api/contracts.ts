export type JenkinsApiErrorCode =
  | 'authentication'
  | 'permission'
  | 'not_found'
  | 'csrf'
  | 'rate_limited'
  | 'server'
  | 'timeout'
  | 'offline'
  | 'invalid_response';

export class JenkinsApiError extends Error {
  readonly code: JenkinsApiErrorCode;
  readonly status?: number;
  readonly retryAfterMs?: number;

  constructor(code: JenkinsApiErrorCode, message: string, status?: number, retryAfterMs?: number) {
    super(message);
    this.name = 'JenkinsApiError';
    this.code = code;
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

export function createJenkinsHttpError(response: Response, responseText = ''): JenkinsApiError {
  const status = response.status;
  const normalizedBody = responseText.toLowerCase();
  const retryAfterMs = parseRetryAfter(response.headers.get('Retry-After'));

  if (status === 401) {
    return new JenkinsApiError('authentication', 'Jenkins 认证失败', status);
  }
  if (status === 403 && /crumb|csrf/.test(normalizedBody)) {
    return new JenkinsApiError('csrf', 'Jenkins CSRF 校验失败', status);
  }
  if (status === 403) {
    return new JenkinsApiError('permission', '没有权限访问 Jenkins 资源', status);
  }
  if (status === 404) {
    return new JenkinsApiError('not_found', 'Jenkins 资源不存在', status);
  }
  if (status === 429) {
    return new JenkinsApiError('rate_limited', 'Jenkins 请求过于频繁', status, retryAfterMs);
  }
  return new JenkinsApiError('server', `Jenkins 请求失败 (${status})`, status);
}

export function createJenkinsNetworkError(error: unknown): JenkinsApiError {
  const message = error instanceof Error ? error.message : String(error);
  if (/abort|timeout|超时/i.test(message)) {
    return new JenkinsApiError('timeout', 'Jenkins 请求超时');
  }
  return new JenkinsApiError('offline', '无法连接 Jenkins');
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? undefined : Math.max(0, timestamp - Date.now());
}
