import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { OperationSchema, dbOps } from './db.js';

const SYNC_ACCESS_TOKEN = process.env.SYNC_ACCESS_TOKEN || 'dev-token';
const app = new Hono();
// 认证中间件 - 与 CF Worker 一致
app.use('*', async (c, next) => {
  // 跳过根路径和健康检查
  if (c.req.path === '/' || c.req.path === '/health') {
    return next();
  }
  const token = c.req.header('X-Access-Token');
  if (token !== SYNC_ACCESS_TOKEN) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
});
app.get('/', (c) => c.text('DPP Sync Server'));
// 健康检查接口
app.get('/health', (c) => c.json({ status: 'ok' }));
app.post('/api/sync/push', async (c) => {
  try {
    const { ops } = await c.req.json();
    if (!ops || !Array.isArray(ops)) {
      return c.json({ error: 'Invalid payload' }, 400);
    }
    const validatedOps = ops.map((op) => OperationSchema.parse(op));
    const serverTimestamp = Date.now();
    const opsWithServerTimestamp = validatedOps.map((op) => ({
      ...op,
      serverTimestamp,
    }));
    const newCursor = dbOps.push(opsWithServerTimestamp);
    return c.json({ success: true, cursor: newCursor });
  } catch (e) {
    const error = e;
    return c.json({ error: error.message, stack: error.stack }, 500);
  }
});
app.get('/api/sync/pull', (c) => {
  try {
    const cursorStr = c.req.query('cursor');
    const cursor = Number.parseInt(cursorStr || '0', 10) || 0;
    const limitStr = c.req.query('limit');
    const limit = limitStr ? Number.parseInt(limitStr, 10) : 100;
    const { ops, nextCursor } = dbOps.pull(cursor, limit);
    return c.json({ ops, cursor: nextCursor });
  } catch (e) {
    const error = e;
    return c.json({ error: error.message, stack: error.stack }, 500);
  }
});
app.get('/api/sync/pending', (c) => {
  try {
    const cursorStr = c.req.query('cursor');
    const cursor = Number.parseInt(cursorStr || '0', 10) || 0;
    const count = dbOps.countPending(cursor);
    return c.json({ count });
  } catch (e) {
    const error = e;
    return c.json({ error: error.message, stack: error.stack }, 500);
  }
});
const port = 8889;
console.log(`Server is running on port ${port}`);
serve({
  fetch: app.fetch,
  port,
});
