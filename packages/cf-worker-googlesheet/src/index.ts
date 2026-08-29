import { D1SyncStore, SyncConflictError, SyncValidationError } from './lib/d1';
import type { SyncOperation } from './lib/d1';
import { SyncPushCoordinator } from './lib/pushCoordinator';
import { RequestTooLargeError, parsePushRequest } from './lib/requestValidation';

interface WorkerEnv extends Env {
  SYNC_ACCESS_TOKEN: string;
}

function parseNonNegativeInteger(value: string | null, name: string): number {
  if (value === null || value === '') return 0;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`Invalid ${name}`);
  return parsed;
}

function parseLimit(value: string | null): number {
  const limit = value === null ? 100 : Number(value);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) {
    throw new Error('Invalid limit');
  }
  return limit;
}

async function tokensMatch(provided: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(provided)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  return crypto.subtle.timingSafeEqual(providedHash, expectedHash);
}

function errorResponse(error: unknown): Response {
  const normalized = error instanceof Error ? error : new Error(String(error));
  const validation =
    normalized instanceof SyncValidationError ||
    normalized.name === 'SyncValidationError' ||
    normalized instanceof SyntaxError ||
    /Invalid|Unencrypted|exceeds the maximum/.test(normalized.message);
  const status =
    normalized instanceof RequestTooLargeError || normalized.name === 'RequestTooLargeError'
      ? 413
      : normalized instanceof SyncConflictError ||
          normalized.name === 'SyncConflictError' ||
          normalized.message.includes('different content')
        ? 409
        : validation
          ? 400
          : 500;
  return Response.json({ error: normalized.message }, { status });
}

async function handleRequest(request: Request, env: WorkerEnv): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === 'GET' && url.pathname === '/') {
    return new Response('DPP Sync Worker');
  }
  if (request.method === 'GET' && url.pathname === '/health') {
    return Response.json({ status: 'ok' });
  }
  if (request.method === 'POST' && url.pathname === '/api/sync/push') {
    const { ops, clientId } = await parsePushRequest(request);
    const coordinator = env.SYNC_PUSH_COORDINATOR.getByName('global');
    const result = await coordinator.push(
      ops as SyncOperation[],
      clientId || request.headers.get('X-Client-ID') || undefined
    );
    return Response.json(result);
  }
  if (request.method === 'GET' && url.pathname === '/api/sync/pull') {
    const cursor = parseNonNegativeInteger(url.searchParams.get('cursor'), 'cursor');
    const limit = parseLimit(url.searchParams.get('limit'));
    return Response.json(await new D1SyncStore(env.DB).pull(cursor, limit));
  }
  if (request.method === 'GET' && url.pathname === '/api/sync/pending') {
    const cursor = parseNonNegativeInteger(url.searchParams.get('cursor'), 'cursor');
    const clientId = url.searchParams.get('clientId') || undefined;
    return Response.json({ count: await new D1SyncStore(env.DB).countPending(cursor, clientId) });
  }

  return Response.json({ error: 'Not found' }, { status: 404 });
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
      return url.pathname === '/'
        ? new Response('DPP Sync Worker')
        : Response.json({ status: 'ok' });
    }
    const provided = request.headers.get('X-Access-Token') ?? '';
    if (!env.SYNC_ACCESS_TOKEN || !(await tokensMatch(provided, env.SYNC_ACCESS_TOKEN))) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
      return await handleRequest(request, env);
    } catch (error) {
      return errorResponse(error);
    }
  },
} satisfies ExportedHandler<WorkerEnv>;

export { SyncPushCoordinator };
