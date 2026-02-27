/// <reference types="@cloudflare/workers-types" />
import { Hono } from 'hono';
import { getAuthToken } from './lib/google-auth';
import { SheetsClient, type SyncOperation } from './lib/sheets';

interface Env {
  GOOGLE_SERVICE_ACCOUNT: string;
  SYNC_ACCESS_TOKEN: string;
  GOOGLE_SPREADSHEET_ID: string;
  KV: KVNamespace;
}

const app = new Hono<{ Bindings: Env }>();

app.use('*', async (c, next) => {
  const token = c.req.header('X-Access-Token');
  if (token !== c.env.SYNC_ACCESS_TOKEN) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
});

app.get('/', (c) => c.text('DPP Sync Worker'));

// 健康检查接口
app.get('/health', (c) => c.json({ status: 'ok' }));

app.post('/api/sync/push', async (c) => {
  try {
    const { ops } = await c.req.json<{ ops: SyncOperation[] }>();
    if (!ops || !Array.isArray(ops)) {
      return c.json({ error: 'Invalid payload' }, 400);
    }

    const serverTimestamp = Date.now();
    const opsWithServerTimestamp = ops.map((op) => ({
      ...op,
      serverTimestamp,
    }));

    const auth = getAuthToken(c.env);
    const client = new SheetsClient(c.env.GOOGLE_SPREADSHEET_ID, auth);

    const newCursor = await client.appendRows(opsWithServerTimestamp);

    await c.env.KV.put('last_cursor', newCursor.toString());

    return c.json({ success: true, cursor: newCursor });
  } catch (e) {
    const error = e as Error;
    return c.json({ error: error.message, stack: error.stack }, 500);
  }
});

app.get('/api/sync/pull', async (c) => {
  try {
    const cursorStr = c.req.query('cursor');
    const cursor = Number.parseInt(cursorStr || '0', 10) || 0;
    const limitStr = c.req.query('limit');
    const limit = limitStr ? Number.parseInt(limitStr, 10) : 100;

    const auth = getAuthToken(c.env);
    const client = new SheetsClient(c.env.GOOGLE_SPREADSHEET_ID, auth);

    const { ops, nextCursor } = await client.readRows(cursor - 1, limit);

    return c.json({ ops, cursor: nextCursor });
  } catch (e) {
    const error = e as Error;
    return c.json({ error: error.message, stack: error.stack }, 500);
  }
});

app.get('/api/sync/pending', async (c) => {
  try {
    const cursorStr = c.req.query('cursor');
    const cursor = Number.parseInt(cursorStr || '0', 10) || 0;

    const lastCursorStr = await c.env.KV.get('last_cursor');
    const lastCursor = Number.parseInt(lastCursorStr || '0', 10) || 0;

    const count = Math.max(0, lastCursor - cursor);

    return c.json({ count });
  } catch (e) {
    const error = e as Error;
    return c.json({ error: error.message, stack: error.stack }, 500);
  }
});

export default app;
