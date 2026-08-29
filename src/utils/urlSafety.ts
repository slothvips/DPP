import { logger } from '@/utils/logger';

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

// 私有 IP 段、loopback、link-local(含云元数据 169.254.169.254)等保留地址
const PRIVATE_HOST_PATTERNS = [
  /^127\./, // 127.0.0.0/8 (loopback)
  /^10\./, // 10.0.0.0/8 (私有)
  /^192\.168\./, // 192.168.0.0/16 (私有)
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12 (私有)
  /^169\.254\./, // 169.254.0.0/16 (link-local,含 AWS/GCP 云元数据)
  /^0\./, // 0.0.0.0/8
  /^::1$/, // IPv6 loopback
  /^fc[0-9a-f]{2}:/i, // IPv6 ULA fc00::/7
  /^fd[0-9a-f]{2}:/i,
  /^fe80:/i, // IPv6 link-local
  /^localhost$/i,
];

export interface UrlSafetyResult {
  ok: boolean;
  reason?: string;
}

/**
 * 判断 host 是否为私有/本地地址
 */
export function isPrivateOrLocalHost(hostname: string): boolean {
  return PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(hostname));
}

/**
 * 判断 URL 协议是否允许(http/https)
 */
export function isAllowedProtocol(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * 从 URL 字符串提取 hostname(小写)
 *
 * 兼容无协议输入:
 * - "https://jenkins.example.com/path" → "jenkins.example.com"
 * - "jenkins.example.com" → "jenkins.example.com"(自动补 https://)
 * - "http://192.168.1.10:8080" → "192.168.1.10"
 */
export function extractHostname(url: string): string | null {
  if (!url) return null;

  // 若不含协议前缀,补 https:// 再解析
  const normalized = /^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`;
  try {
    return new URL(normalized).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function extractOrigin(url: string): string | null {
  if (!url) return null;
  const normalized = /^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`;
  try {
    const parsed = new URL(normalized);
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol) || parsed.username || parsed.password) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

/**
 * 将相对 URL 基于 origin 解析为绝对 URL
 * 如果 url 已经是绝对 URL,直接返回
 */
export function resolveUrl(url: string, baseOrigin?: string): string | null {
  // 绝对 URL 直接返回
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) {
    return url;
  }
  if (!baseOrigin) return null;
  try {
    return new URL(url, baseOrigin).href;
  } catch {
    return null;
  }
}

/**
 * 校验 fetch URL 是否安全(防 SSRF)
 *
 * 规则:
 * - 必须是 http/https 协议(拒绝 file:、data: 等)
 * - origin 必须在白名单内(协议、hostname、有效端口完全一致)
 *
 * @param url 待校验的绝对 URL
 * @param allowedOrigins 允许的 origin 白名单
 */
export function assertFetchUrlSafe(url: string, allowedOrigins: Set<string>): UrlSafetyResult {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: 'Invalid URL' };
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    return { ok: false, reason: `Protocol not allowed: ${parsed.protocol}` };
  }

  if (parsed.username || parsed.password) {
    return { ok: false, reason: 'URL userinfo is not allowed' };
  }

  const host = parsed.hostname.toLowerCase();
  if (allowedOrigins.has(parsed.origin)) {
    return { ok: true };
  }

  // 非白名单的私有/本地地址一律拒绝
  if (isPrivateOrLocalHost(host)) {
    logger.warn(`[urlSafety] Blocked private/local host: ${host}`);
    return { ok: false, reason: `Blocked private/local host: ${host}` };
  }

  return { ok: false, reason: `Origin not allowed: ${parsed.origin}` };
}
