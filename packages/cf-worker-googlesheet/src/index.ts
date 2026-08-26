/// <reference types="@cloudflare/workers-types" />
import { Hono } from 'hono';
import { getAuthToken } from './lib/google-auth';
import { SyncPushCoordinator } from './lib/pushCoordinator';
import { SheetsClient, type SyncOperation, getSheetReadOffset } from './lib/sheets';

interface Env {
  GOOGLE_SERVICE_ACCOUNT: string;
  SYNC_ACCESS_TOKEN: string;
  GOOGLE_SPREADSHEET_ID: string;
  KV: KVNamespace;
  SYNC_PUSH_COORDINATOR: DurableObjectNamespace<SyncPushCoordinator>;
}

const app = new Hono<{ Bindings: Env }>();

function parseNonNegativeInteger(value: string | undefined, name: string): number {
  if (value === undefined || value === '') return 0;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid ${name}`);
  }
  return parsed;
}

function parseLimit(value: string | undefined): number {
  const limit = value === undefined ? 100 : Number(value);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) {
    throw new Error('Invalid limit');
  }
  return limit;
}

app.use('*', async (c, next) => {
  const token = c.req.header('X-Access-Token');
  if (!c.env.SYNC_ACCESS_TOKEN || token !== c.env.SYNC_ACCESS_TOKEN) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
});

app.get('/', (c) => c.text('DPP Sync Worker'));

// 健康检查接口
app.get('/health', (c) => c.json({ status: 'ok' }));

app.post('/api/sync/push', async (c) => {
  try {
    const { ops, clientId } = await c.req.json<{ ops: SyncOperation[]; clientId?: string }>();
    if (!ops || !Array.isArray(ops)) {
      return c.json({ error: 'Invalid payload' }, 400);
    }

    const coordinator = c.env.SYNC_PUSH_COORDINATOR.getByName(c.env.GOOGLE_SPREADSHEET_ID);
    const result = await coordinator.push(ops, clientId || c.req.header('X-Client-ID'));
    return c.json(result);
  } catch (e) {
    const error = e as Error;
    const status =
      error.message.includes('already exists') || error.message.includes('different content')
        ? 409
        : error.message.includes('Invalid sync chunk') ||
            error.message.includes('mismatched clientId') ||
            error.message.includes('exceeds the maximum payload size')
          ? 400
          : 500;
    return c.json({ error: error.message }, status);
  }
});

app.get('/api/sync/pull', async (c) => {
  try {
    const cursor = parseNonNegativeInteger(c.req.query('cursor'), 'cursor');
    const limit = parseLimit(c.req.query('limit'));

    const auth = getAuthToken(c.env);
    const client = new SheetsClient(c.env.GOOGLE_SPREADSHEET_ID, auth);

    const { ops, nextCursor } = await client.readRows(getSheetReadOffset(cursor), limit);

    return c.json({ ops, cursor: nextCursor });
  } catch (e) {
    const error = e as Error;
    return c.json({ error: error.message, stack: error.stack }, 500);
  }
});

app.get('/api/sync/pending', async (c) => {
  try {
    const cursor = parseNonNegativeInteger(c.req.query('cursor'), 'cursor');
    const clientId = c.req.query('clientId');
    const auth = getAuthToken(c.env);
    const client = new SheetsClient(c.env.GOOGLE_SPREADSHEET_ID, auth);
    let pageCursor = cursor;
    let count = 0;

    for (let page = 0; page < 100; page++) {
      const { ops, nextCursor } = await client.readRows(getSheetReadOffset(pageCursor), 1000);
      count += ops.filter((operation) => !clientId || operation.clientId !== clientId).length;
      if (ops.length === 0 || nextCursor === pageCursor) {
        break;
      }
      pageCursor = nextCursor;
    }

    return c.json({ count });
  } catch (e) {
    const error = e as Error;
    return c.json({ error: error.message, stack: error.stack }, 500);
  }
});

export default app;
export { SyncPushCoordinator };
