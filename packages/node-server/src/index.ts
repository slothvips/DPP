import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { OperationSchema, SyncConflictError, dbOps } from './db.js';

const SYNC_ACCESS_TOKEN = process.env.SYNC_ACCESS_TOKEN;

const app = new Hono();

function normalizeClientIdentity<T extends { clientId?: string; table: string; payload?: unknown }>(
  operation: T,
  clientId: string | undefined
): T {
  if (!clientId) {
    return operation;
  }

  if (
    operation.table === '__sync_chunk__' &&
    typeof operation.payload === 'object' &&
    operation.payload !== null
  ) {
    return {
      ...operation,
      clientId,
      payload: { ...(operation.payload as Record<string, unknown>), clientId },
    };
  }

  return { ...operation, clientId };
}

function parseNonNegativeInteger(value: string | undefined, name: string): number {
  if (value === undefined || value === '') return 0;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid ${name}`);
  }
  return parsed;
}

// 认证中间件 - 与 CF Worker 一致
app.use('*', async (c, next) => {
  // 跳过根路径和健康检查
  if (c.req.path === '/' || c.req.path === '/health') {
    return next();
  }

  const token = c.req.header('X-Access-Token');
  if (!SYNC_ACCESS_TOKEN || token !== SYNC_ACCESS_TOKEN) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
});

app.get('/', (c) => c.text('DPP Sync Server'));

// 健康检查接口
app.get('/health', (c) => c.json({ status: 'ok' }));

app.post('/api/sync/push', async (c) => {
  try {
    const { ops, clientId: bodyClientId } = await c.req.json<{
      ops: unknown[];
      clientId?: string;
    }>();
    const clientId = bodyClientId || c.req.header('X-Client-ID');
    if (!ops || !Array.isArray(ops)) {
      return c.json({ error: 'Invalid payload' }, 400);
    }

    const validatedOps = ops.map((op) => {
      const parsed = OperationSchema.parse(op);
      return normalizeClientIdentity(parsed, clientId);
    });
    const serverTimestamp = Date.now();
    const opsWithServerTimestamp = validatedOps.map((op) => ({
      ...op,
      serverTimestamp,
    }));

    const { cursor: newCursor, pushedIds } = dbOps.push(opsWithServerTimestamp);

    return c.json({ success: true, cursor: newCursor, pushedIds });
  } catch (e) {
    if (e instanceof SyncConflictError) {
      return c.json({ error: e.message }, 409);
    }
    const error = e as Error;
    return c.json({ error: error.message }, 400);
  }
});

app.get('/api/sync/pull', (c) => {
  try {
    const cursorStr = c.req.query('cursor');
    const cursor = parseNonNegativeInteger(cursorStr, 'cursor');
    const limitStr = c.req.query('limit');
    const limit = limitStr === undefined ? 100 : Number(limitStr);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) {
      throw new Error('Invalid limit');
    }

    const { ops, nextCursor } = dbOps.pull(cursor, limit);

    return c.json({ ops, cursor: nextCursor });
  } catch (e) {
    const error = e as Error;
    return c.json({ error: error.message, stack: error.stack }, 500);
  }
});

app.get('/api/sync/pending', (c) => {
  try {
    const cursorStr = c.req.query('cursor');
    const cursor = parseNonNegativeInteger(cursorStr, 'cursor');
    const clientId = c.req.query('clientId') || undefined;

    const count = dbOps.countPending(cursor, clientId);

    return c.json({ count });
  } catch (e) {
    const error = e as Error;
    return c.json({ error: error.message, stack: error.stack }, 500);
  }
});

const port = 8889;

serve({
  fetch: app.fetch,
  port,
});
