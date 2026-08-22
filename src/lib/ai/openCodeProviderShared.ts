import type { ChatMessage } from './types';

const OPEN_CODE_CLIENT = 'cli';
const OPEN_CODE_VERSION = '1.18.18';
const DPP_CLIENT_VERSION = '0.7.0';
const SESSION_CACHE_LIMIT = 64;
export const OPEN_CODE_DEFAULT_FREE_MODEL = 'big-pickle';

export function normalizeOpenCodeModel(modelId: string): string {
  return modelId === 'opencodefree' ? OPEN_CODE_DEFAULT_FREE_MODEL : modelId;
}

function createIdentifier(prefix: string): string {
  if (typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`;
  }
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return `${prefix}_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

function openCodeUserAgent(): string {
  const platform = typeof navigator !== 'undefined' ? navigator.platform || 'unknown' : 'unknown';
  return `opencode/${OPEN_CODE_VERSION} (${platform}; DPP/${DPP_CLIENT_VERSION})`;
}

export interface OpenCodeRequestIdentity {
  session: string;
  project: string;
}

export function createOpenCodeRequestIdentity(): OpenCodeRequestIdentity {
  return { session: createIdentifier('ses'), project: createIdentifier('prj') };
}

export function createOpenCodeRequestId(): string {
  return createIdentifier('req');
}

export interface OpenCodeHeaderOptions {
  stream?: boolean;
  apiKey?: string;
}

export function getOpenCodeHeaders(
  identity: OpenCodeRequestIdentity,
  requestId: string,
  options?: OpenCodeHeaderOptions
): HeadersInit {
  return {
    Authorization: `Bearer ${options?.apiKey || 'public'}`,
    Accept: options?.stream ? 'text/event-stream' : 'application/json, text/event-stream',
    'X-Opencode-Client': OPEN_CODE_CLIENT,
    'X-Opencode-Session': identity.session,
    'X-Opencode-Request': requestId,
    'X-Opencode-Project': identity.project,
    'User-Agent': openCodeUserAgent(),
  };
}

export function getOpenCodeModelHeaders(apiKey?: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey || 'public'}`,
    Accept: 'application/json',
    'X-Opencode-Client': OPEN_CODE_CLIENT,
    'User-Agent': openCodeUserAgent(),
  };
}

const sessionCache = new Map<string, string>();

export async function deriveOpenCodeSessionId(
  messages: ChatMessage[]
): Promise<string | undefined> {
  const seed = messages.find((message) => message.role === 'user')?.content;
  if (!seed) {
    return undefined;
  }
  const cached = sessionCache.get(seed);
  if (cached) {
    return cached;
  }

  try {
    const data = new TextEncoder().encode(`ses\u0000${seed}`);
    const digest = await crypto.subtle.digest('SHA-256', data);
    const bytes = Array.from(new Uint8Array(digest).slice(0, 12));
    const sessionId = `ses_${bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
    if (sessionCache.size >= SESSION_CACHE_LIMIT) {
      const oldest = sessionCache.keys().next().value;
      if (oldest !== undefined) {
        sessionCache.delete(oldest);
      }
    }
    sessionCache.set(seed, sessionId);
    return sessionId;
  } catch {
    return undefined;
  }
}

export function isOpenCodeFreeModel(modelId: string): boolean {
  return modelId === 'opencodefree' || modelId === 'big-pickle' || modelId.endsWith('-free');
}
