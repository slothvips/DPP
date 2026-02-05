import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { serve } from '@hono/node-server';
import { OperationSchema, dbOps } from './db.js';

const app = new Hono();

app.use('/*', cors());

app.use('*', async (c, next) => {
  console.log(`\n[${new Date().toISOString()}] ${c.req.method} ${c.req.url}`);

  const query = c.req.query();
  if (Object.keys(query).length > 0) {
    console.log('Query:', JSON.stringify(query, null, 2));
  }

  if (['POST', 'PUT', 'PATCH'].includes(c.req.method)) {
    try {
      const body = await c.req.raw.clone().json();
      console.log('Request Body:', JSON.stringify(body, null, 2));
    } catch {
      // Body is not JSON or empty, skip logging
    }
  }

  await next();

  try {
    const resClone = c.res.clone();
    const text = await resClone.text();
    try {
      const json = JSON.parse(text);
      console.log('Response Body:', JSON.stringify(json, null, 2));
    } catch {
      console.log('Response Body:', text);
    }
  } catch (e) {
    console.log('Error logging response:', e);
  }
});

app.get('/', (c) => {
  return c.text('DPP Sync Server Running');
});

// 健康检查接口
app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

const PushSchema = z.object({
  ops: z.array(OperationSchema),
  clientId: z.string().optional(),
});

app.post('/api/sync/push', async (c) => {
  try {
    const body = await c.req.json();
    const { ops, clientId } = PushSchema.parse(body);
    const headerClientId = c.req.header('X-Client-ID');

    dbOps.push(ops, clientId || headerClientId);

    return c.json({ success: true, count: ops.length });
  } catch (e) {
    console.error(e);
    return c.json({ success: false, error: 'Invalid request' }, 400);
  }
});

app.get('/api/sync/pull', (c) => {
  const cursor = Number(c.req.query('cursor')) || 0;
  const clientId = c.req.query('clientId');

  const ops = dbOps.pull(cursor, clientId);

  const nextCursor = ops.length > 0 ? ops[ops.length - 1].server_seq : cursor;

  return c.json({
    ops: ops.map(({ server_seq: _seq, ...op }) => op),
    cursor: nextCursor,
  });
});

app.get('/api/sync/pending', (c) => {
  const cursor = Number(c.req.query('cursor')) || 0;
  const clientId = c.req.query('clientId');

  const count = dbOps.countPending(cursor, clientId);

  return c.json({ count });
});

const port = 8889;
console.log(`Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});
