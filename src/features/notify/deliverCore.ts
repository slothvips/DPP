import { canonicalChatId, notifyClaimKey } from './canonical.ts';

export interface DeliverOnceInput {
  scope: string;
  dedupKey: string;
  text: string;
  occurredAt: number;
  file?: { filename: string; body: string };
  /** 只发给这些对象。空数组表示这次没有接收者，发送完成。不传则发给全部。 */
  targetIds?: string[];
}

export interface DeliverOnceResult {
  complete: boolean;
  halt?: boolean;
}

export interface DeliverTarget {
  id: string;
  chatId: string;
  deletedAt?: number | null;
}

export type TelegramSendResult = 'ok' | 'permanent' | 'retry' | 'token_dead';

export interface DeliverPorts {
  loadToken(): Promise<string>;
  loadTargets(): Promise<DeliverTarget[]>;
  getClientId(): Promise<string>;
  request(path: string, body: unknown): Promise<{ status: number; body: unknown }>;
  sendTelegram(
    token: string,
    chatId: string,
    text: string,
    file?: { filename: string; body: string }
  ): Promise<TelegramSendResult>;
}

const sinceCache = new Map<string, number>();

export function clearNotifySinceCache(): void {
  sinceCache.clear();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

type SinceRead =
  | { kind: 'ok'; sinceMs: number }
  | { kind: 'missing' }
  | { kind: 'halt' }
  | { kind: 'failed' };

async function readSince(ports: DeliverPorts, scope: string, targetId: string): Promise<SinceRead> {
  const cacheKey = `${scope}\n${targetId}`;
  const cached = sinceCache.get(cacheKey);
  if (cached !== undefined) return { kind: 'ok', sinceMs: cached };

  let response: { status: number; body: unknown };
  try {
    response = await ports.request('/api/notify/since', { scope, targetId, create: false });
  } catch {
    return { kind: 'failed' };
  }
  if (response.status === 404) return { kind: 'missing' };
  if (response.status === 429 || response.status === 401) return { kind: 'halt' };
  if (response.status !== 200) return { kind: 'failed' };
  const sinceMs = asRecord(response.body)?.sinceMs;
  if (typeof sinceMs !== 'number' || !Number.isFinite(sinceMs)) return { kind: 'failed' };
  sinceCache.set(cacheKey, sinceMs);
  return { kind: 'ok', sinceMs };
}

async function postClaim(
  ports: DeliverPorts,
  path: string,
  body: unknown
): Promise<{ halt?: boolean; failed?: boolean; body?: Record<string, unknown> }> {
  let response: { status: number; body: unknown };
  try {
    response = await ports.request(path, body);
  } catch {
    return { failed: true };
  }
  if (response.status === 429 || response.status === 401) return { halt: true };
  if (response.status !== 200) return { failed: true };
  const record = asRecord(response.body);
  if (!record) return { failed: true };
  return { body: record };
}

export async function deliverOnce(
  input: DeliverOnceInput,
  ports: DeliverPorts
): Promise<DeliverOnceResult> {
  const token = (await ports.loadToken()).trim();
  const allowed = input.targetIds ? new Set(input.targetIds) : null;
  const targets = (await ports.loadTargets())
    .filter((target) => target.deletedAt == null && (allowed === null || allowed.has(target.id)))
    .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
  if (allowed && targets.length === 0) return { complete: true };
  if (!token || targets.length === 0) return { complete: false };

  let clientId: string;
  try {
    clientId = await ports.getClientId();
  } catch {
    return { complete: false };
  }
  if (!clientId) return { complete: false };

  for (const target of targets) {
    const chatId = canonicalChatId(target.chatId);
    if (!chatId) return { complete: false };

    const since = await readSince(ports, input.scope, target.id);
    if (since.kind === 'halt') return { complete: false, halt: true };
    if (since.kind !== 'ok') return { complete: false };
    if (input.occurredAt < since.sinceMs) continue;

    const claimKey = await notifyClaimKey(input.scope, chatId, input.dedupKey);
    const claim = await postClaim(ports, '/api/notify/claim', { claimKey, clientId });
    if (claim.halt) return { complete: false, halt: true };
    if (claim.failed || !claim.body) return { complete: false };
    if (claim.body.granted !== true) {
      if (claim.body.status === 'sent') continue;
      return { complete: false };
    }

    const sent = await ports.sendTelegram(token, chatId, input.text, input.file);
    if (sent !== 'ok' && sent !== 'permanent') {
      return { complete: false, halt: sent === 'token_dead' };
    }
    const ack = await postClaim(ports, '/api/notify/ack', { claimKey, clientId });
    if (ack.halt) return { complete: false, halt: true };
    if (ack.failed || ack.body?.updated !== true) return { complete: false };
  }

  return { complete: true };
}
