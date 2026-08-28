import { D1SyncStore, SyncConflictError, SyncValidationError } from './lib/d1';
import { getAuthToken } from './lib/google-auth';
import { MigrationSyncPushCoordinator } from './lib/migrationCoordinator';
import { SheetsClient, type SyncOperation, getSheetReadOffset } from './lib/sheets';

interface MigrationEnv {
  DB: D1Database;
  GOOGLE_SERVICE_ACCOUNT: string;
  GOOGLE_SPREADSHEET_ID: string;
  KV: KVNamespace;
  MIGRATION_ADMIN_TOKEN: string;
  SYNC_ACCESS_TOKEN: string;
  SYNC_PUSH_COORDINATOR: DurableObjectNamespace<MigrationSyncPushCoordinator>;
}

function parseNonNegativeInteger(value: string | null, name: string): number {
  if (value === null || value === '') return 0;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`Invalid ${name}`);
  return parsed;
}

function parseLimit(value: string | null, maximum: number): number {
  const limit = value === null ? maximum : Number(value);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > maximum) {
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

function coordinator(env: MigrationEnv) {
  return env.SYNC_PUSH_COORDINATOR.getByName(env.GOOGLE_SPREADSHEET_ID);
}

function errorResponse(error: unknown): Response {
  const normalized = error instanceof Error ? error : new Error(String(error));
  const conflict =
    normalized instanceof SyncConflictError ||
    normalized.name === 'SyncConflictError' ||
    normalized.message.includes('different content');
  const validation =
    normalized instanceof SyncValidationError ||
    normalized.name === 'SyncValidationError' ||
    normalized instanceof SyntaxError ||
    /Invalid|Unencrypted|exceeds the maximum/.test(normalized.message);
  const status = normalized.message.includes('temporarily unavailable')
    ? 503
    : normalized.message.includes('must be enabled')
      ? 409
      : conflict
        ? 409
        : validation
          ? 400
          : 500;
  return Response.json(
    { error: normalized.message, ...(conflict ? { conflicts: 1 } : {}) },
    { status }
  );
}

async function handleSyncRequest(
  request: Request,
  env: MigrationEnv,
  url: URL
): Promise<Response | null> {
  if (request.method === 'POST' && url.pathname === '/api/sync/push') {
    const body = await request.json<unknown>();
    if (typeof body !== 'object' || body === null) {
      return Response.json({ error: 'Invalid payload' }, { status: 400 });
    }
    const { ops, clientId } = body as { ops?: unknown; clientId?: unknown };
    if (!Array.isArray(ops)) return Response.json({ error: 'Invalid payload' }, { status: 400 });
    if (clientId !== undefined && typeof clientId !== 'string') {
      return Response.json({ error: 'Invalid clientId' }, { status: 400 });
    }
    return Response.json(
      await coordinator(env).push(
        ops as SyncOperation[],
        clientId || request.headers.get('X-Client-ID') || undefined
      )
    );
  }
  if (request.method === 'GET' && url.pathname === '/api/sync/pull') {
    const cursor = parseNonNegativeInteger(url.searchParams.get('cursor'), 'cursor');
    const limit = parseLimit(url.searchParams.get('limit'), 1000);
    const client = new SheetsClient(env.GOOGLE_SPREADSHEET_ID, getAuthToken(env));
    const { ops, nextCursor } = await client.readRows(getSheetReadOffset(cursor), limit);
    return Response.json({ ops, cursor: nextCursor });
  }
  if (request.method === 'GET' && url.pathname === '/api/sync/pending') {
    const cursor = parseNonNegativeInteger(url.searchParams.get('cursor'), 'cursor');
    const clientId = url.searchParams.get('clientId') || undefined;
    const client = new SheetsClient(env.GOOGLE_SPREADSHEET_ID, getAuthToken(env));
    let pageCursor = cursor;
    let count = 0;
    for (let page = 0; page < 100; page++) {
      const { ops, nextCursor } = await client.readRows(getSheetReadOffset(pageCursor), 1000);
      count += ops.filter((operation) => !clientId || operation.clientId !== clientId).length;
      if (ops.length === 0 || nextCursor === pageCursor) break;
      pageCursor = nextCursor;
    }
    return Response.json({ count });
  }
  return null;
}

async function handleMigrationRequest(
  request: Request,
  env: MigrationEnv,
  url: URL
): Promise<Response | null> {
  if (request.method === 'POST' && url.pathname === '/api/migration/lock') {
    const body = await request.json<unknown>();
    if (typeof body !== 'object' || body === null) {
      return Response.json({ error: 'Invalid payload' }, { status: 400 });
    }
    const { locked } = body as { locked?: unknown };
    if (typeof locked !== 'boolean') {
      return Response.json({ error: 'Invalid payload' }, { status: 400 });
    }
    return Response.json({ locked: await coordinator(env).setMaintenanceLocked(locked) });
  }
  if (request.method === 'GET' && url.pathname === '/api/migration/status') {
    const [locked, database] = await Promise.all([
      coordinator(env).isMaintenanceLocked(),
      new D1SyncStore(env.DB).stats(),
    ]);
    return Response.json({ locked, database });
  }
  if (request.method === 'POST' && url.pathname === '/api/migration/import') {
    const cursor = parseNonNegativeInteger(url.searchParams.get('cursor'), 'cursor');
    const limit = parseLimit(url.searchParams.get('limit'), 50);
    const client = new SheetsClient(env.GOOGLE_SPREADSHEET_ID, getAuthToken(env));
    const page = await client.readRows(getSheetReadOffset(cursor), limit);
    const result = await coordinator(env).importHistorical(page.records);
    return Response.json({
      ...result,
      read: page.records.length,
      sourceCursor: page.nextCursor,
      done: page.records.length === 0,
    });
  }
  return null;
}

async function handleRequest(request: Request, env: MigrationEnv): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === 'GET' && url.pathname === '/') {
    return new Response('DPP Sync Migration Worker');
  }
  if (request.method === 'GET' && url.pathname === '/health') {
    return Response.json({ status: 'ok', mode: 'migration' });
  }
  return (
    (await handleSyncRequest(request, env, url)) ??
    (await handleMigrationRequest(request, env, url)) ??
    Response.json({ error: 'Not found' }, { status: 404 })
  );
}

export default {
  async fetch(request: Request, env: MigrationEnv): Promise<Response> {
    const provided = request.headers.get('X-Access-Token') ?? '';
    const pathname = new URL(request.url).pathname;
    const expectedToken = pathname.startsWith('/api/migration/')
      ? env.MIGRATION_ADMIN_TOKEN
      : env.SYNC_ACCESS_TOKEN;
    if (!expectedToken || !(await tokensMatch(provided, expectedToken))) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
      return await handleRequest(request, env);
    } catch (error) {
      return errorResponse(error);
    }
  },
} satisfies ExportedHandler<MigrationEnv>;

export { MigrationSyncPushCoordinator as SyncPushCoordinator };
