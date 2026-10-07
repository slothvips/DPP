export type TelegramSendResult = 'ok' | 'permanent' | 'retry' | 'token_dead';

async function postTelegram(
  token: string,
  chatId: string,
  text: string,
  html: boolean,
  markup: string | undefined
): Promise<Response> {
  const body: Record<string, unknown> = { chat_id: chatId, text };
  if (html) body.parse_mode = 'HTML';
  if (markup) body.reply_markup = JSON.parse(markup) as unknown;
  return fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
}

function classifyTelegram(status: number, raw: string): TelegramSendResult | 'fallback' {
  if (status === 400) return 'fallback';
  if (status === 403) return 'permanent';
  if (status === 401 || status === 404) return 'token_dead';
  if (status < 200 || status >= 300) return 'retry';
  try {
    const body = JSON.parse(raw) as { ok?: unknown };
    return body.ok === true ? 'ok' : 'retry';
  } catch {
    return 'retry';
  }
}

const CAPTION_MAX = 1024;

function unescapeHtml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/** Telegram 不把 localhost 当成可点地址。换成 127.0.0.1 后，本机才能打开。 */
function clickableUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'localhost') parsed.hostname = '127.0.0.1';
    return parsed.href;
  } catch {
    return url;
  }
}

function withClickableLinks(text: string): string {
  return text.replace(/href="([^"]+)"/g, (_full, href: string) => {
    const url = clickableUrl(unescapeHtml(href));
    return `href="${url.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`;
  });
}

function openMarkup(text: string): string | undefined {
  const anchors = [...text.matchAll(/<a href="([^"]+)">([\s\S]*?)<\/a>/g)];
  const picked = anchors.find((match) => !match[2].includes('<')) ?? anchors.at(-1);
  if (!picked) return undefined;
  const url = clickableUrl(unescapeHtml(picked[1]));
  if (!/^https?:\/\//i.test(url)) return undefined;
  const label = picked[2].includes('<')
    ? '打开这次构建'
    : picked[2]
        .replace(/<[^>]+>/g, '')
        .replace(/^\p{Extended_Pictographic}\uFE0F?\s*/u, '')
        .trim()
        .slice(0, 64) || '打开';
  return JSON.stringify({ inline_keyboard: [[{ text: label, url }]] });
}

async function postDocument(
  token: string,
  chatId: string,
  filename: string,
  body: string,
  caption: string,
  html: boolean,
  markup: string | undefined
): Promise<Response> {
  const form = new FormData();
  form.set('chat_id', chatId);
  if (caption) {
    form.set('caption', caption);
    if (html) form.set('parse_mode', 'HTML');
  }
  if (markup) form.set('reply_markup', markup);
  form.set('document', new Blob([body], { type: 'text/plain' }), filename);
  return fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(120_000),
  });
}

/** 直接发给 Telegram。失败时不记录地址，避免把机器人 Token 写进日志。 */
export async function sendTelegramMessage(
  token: string,
  chatId: string,
  text: string
): Promise<TelegramSendResult> {
  const linked = withClickableLinks(text);
  const markup = openMarkup(linked);
  try {
    const response = await postTelegram(token, chatId, linked, true, markup);
    const raw = await response.text();
    const result = classifyTelegram(response.status, raw);
    if (result !== 'fallback') return result;
    const again = await postTelegram(token, chatId, linked, true, undefined);
    const againRaw = await again.text();
    const againResult = classifyTelegram(again.status, againRaw);
    if (againResult !== 'fallback') return againResult;
    const plain = await postTelegram(token, chatId, linked, false, undefined);
    const plainRaw = await plain.text();
    const plainResult = classifyTelegram(plain.status, plainRaw);
    return plainResult === 'fallback' ? 'permanent' : plainResult;
  } catch {
    return 'retry';
  }
}

export interface TelegramLogFile {
  filename: string;
  body: string;
}

function captionOf(text: string): string {
  if (text.length <= CAPTION_MAX) return text;
  return `${text.slice(0, CAPTION_MAX - 1)}…`;
}

/** 有日志文件时，说明和文件是同一条消息。说明超过 1024 字会被截断。 */
export async function sendTelegramNotification(
  token: string,
  chatId: string,
  text: string,
  file?: TelegramLogFile
): Promise<TelegramSendResult> {
  if (!file?.body.trim()) return sendTelegramMessage(token, chatId, text);
  const caption = captionOf(withClickableLinks(text));
  const markup = openMarkup(caption);
  try {
    const response = await postDocument(
      token,
      chatId,
      file.filename,
      file.body,
      caption,
      true,
      markup
    );
    const raw = await response.text();
    const result = classifyTelegram(response.status, raw);
    if (result !== 'fallback') return result;
    const again = await postDocument(
      token,
      chatId,
      file.filename,
      file.body,
      caption,
      true,
      undefined
    );
    const againRaw = await again.text();
    const againResult = classifyTelegram(again.status, againRaw);
    if (againResult !== 'fallback') return againResult;
    const plain = await postDocument(
      token,
      chatId,
      file.filename,
      file.body,
      caption,
      false,
      undefined
    );
    const plainRaw = await plain.text();
    const plainResult = classifyTelegram(plain.status, plainRaw);
    return plainResult === 'fallback' ? 'permanent' : plainResult;
  } catch {
    return 'retry';
  }
}
