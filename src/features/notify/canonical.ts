export const JENKINS_BUILD_SCOPE = 'jenkins-build';

const DASH = /[\u2010-\u2015\u2212]/g;
/** 空格、换行、零宽字符、BOM、软连字符等：出现在 chat_id 里一律当没看见。 */
const INVISIBLE = /[\s\p{Cf}]/gu;
const MAX_CHAT_ID_INPUT_LENGTH = 256;
const PRIVATE_LINK =
  /^(?:https?:\/\/)?(?:www\.)?t(?:elegram)?\.me\/c\/(\d+)(?:\/\d+)?\/?(?:[?#].*)?$/i;
const ANY_LINK = /t(?:elegram)?\.me\/|tg:\/\//i;
const CHAT_ID_PREFIX = /^(?:id|chat[_-]?id)[:=]([+-]?\d+)$/i;

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

/** 数字归一化：去掉前导零、统一负号，超过 64 位视为无效。 */
function toChatId(value: string): string | null {
  if (value.length > 64 || !/^[+-]?\d+$/.test(value)) return null;
  try {
    return BigInt(value).toString();
  } catch {
    return null;
  }
}

/**
 * 从用户输入里宽泛地取 chat_id：
 * - 全角数字、空格、引号、零宽字符、`Id: 123` 之类前缀都无所谓；
 * - `t.me/c/<内部id>[/<消息id>]` 私群/频道链接换算成 `-100<内部id>`；
 * - `@username`、`t.me/<群名>`、邀请链接没有数字可取，拒绝（用户名会变，投递去重按 id 走），
 *   同时避免把消息序号当成 chat_id；
 * - 出现多个不同数字时拒绝，不猜。
 */
export function canonicalChatId(raw: string): string | null {
  if (raw.length > MAX_CHAT_ID_INPUT_LENGTH) return null;

  const text = raw.normalize('NFKC').replace(DASH, '-').replace(INVISIBLE, '');
  if (!text) return null;

  const privateLink = text.match(PRIVATE_LINK);
  if (privateLink) {
    const internalId = privateLink[1].replace(/^0+(?=\d)/, '');
    return toChatId(`-100${internalId}`);
  }
  if (ANY_LINK.test(text)) return null;

  const unquoted = text.replace(/^["'`]+|["'`]+$/g, '');
  return toChatId(unquoted.match(CHAT_ID_PREFIX)?.[1] ?? unquoted);
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
