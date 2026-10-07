export const JENKINS_BUILD_SCOPE = 'jenkins-build';

const CHAT_ID = /^-?\d+$/;

/** 协议和主机小写、去掉默认端口、查询串、片段，以及路径末尾的一个斜杠。 */
export function canonicalHttpUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  url.username = '';
  url.password = '';
  url.search = '';
  url.hash = '';
  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.slice(0, -1);
  }
  return url.href;
}

/** 纯数字 chat_id 去掉前导零。`@username` 不能保存。 */
export function canonicalChatId(raw: string): string | null {
  const trimmed = raw.trim();
  if (!CHAT_ID.test(trimmed) || trimmed.length > 64) return null;
  try {
    return BigInt(trimmed).toString();
  } catch {
    return null;
  }
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function notifyClaimKey(
  scope: string,
  chatId: string,
  dedupKey: string
): Promise<string> {
  return sha256Hex(`${scope}\n${chatId}\n${dedupKey}`);
}
