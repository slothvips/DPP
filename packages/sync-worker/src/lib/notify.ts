const KEY_MAX = 128;
const VALUE_MAX = 1024;
const ID_MAX = 200;
const LEASE_MS = 60_000;
const DECIMAL_INTEGER = /^-?(?:0|[1-9]\d*)$/;

function badRequest(): Response {
  return Response.json({ error: 'bad_request' }, { status: 400 });
}

function notFound(): Response {
  return Response.json({ error: 'not_found' }, { status: 404 });
}

function isDecimalInteger(value: string): boolean {
  return DECIMAL_INTEGER.test(value) && Number.isSafeInteger(Number(value));
}

function bounded(value: unknown, max: number): string | null {
  if (typeof value !== 'string' || value.length < 1 || value.length > max) return null;
  return value;
}

async function readObject(request: Request): Promise<Record<string, unknown> | Response> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    return badRequest();
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return badRequest();
  return value as Record<string, unknown>;
}

function isIntegerText(column: string): string {
  return `(
    ${column} = '0' OR ${column} = '-0'
    OR (${column} GLOB '[1-9]*' AND ${column} NOT GLOB '*[^0-9]*')
    OR (${column} GLOB '-[1-9]*' AND substr(${column}, 2) NOT GLOB '*[^0-9]*')
  )`;
}

const KV_UPSERT = `
INSERT INTO kv_entries (entry_key, value, updated_at) VALUES (?, ?, ?)
ON CONFLICT(entry_key) DO UPDATE SET
  value = excluded.value,
  updated_at = excluded.updated_at
WHERE ? = 'any'
  OR (
    ? = 'increase' AND (
      (? = 'string' AND excluded.value > kv_entries.value)
      OR (? = 'number' AND ${isIntegerText('kv_entries.value')}
        AND CAST(excluded.value AS INTEGER) > CAST(kv_entries.value AS INTEGER))
    )
  )
  OR (
    ? = 'decrease' AND (
      (? = 'string' AND excluded.value < kv_entries.value)
      OR (? = 'number' AND ${isIntegerText('kv_entries.value')}
        AND CAST(excluded.value AS INTEGER) < CAST(kv_entries.value AS INTEGER))
    )
  )
`;

const CLAIM_UPSERT = `
INSERT INTO notify_claims (claim_key, owner_client_id, status, lease_until, updated_at)
VALUES (?, ?, 'leased', ?, ?)
ON CONFLICT(claim_key) DO UPDATE SET
  owner_client_id = excluded.owner_client_id,
  status = 'leased',
  lease_until = excluded.lease_until,
  updated_at = excluded.updated_at
WHERE notify_claims.status = 'leased'
  AND (
    notify_claims.lease_until < excluded.updated_at
    OR notify_claims.owner_client_id = excluded.owner_client_id
  )
`;

function changesOf(result: D1Result): number {
  return result.meta?.changes ?? 0;
}

function firstRow<T>(result: D1Result<T>): T | undefined {
  return result.results?.[0];
}

async function handleKvGet(url: URL, db: D1Database): Promise<Response> {
  const key = bounded(url.searchParams.get('key'), KEY_MAX);
  if (!key) return badRequest();
  const row = await db
    .prepare('SELECT value FROM kv_entries WHERE entry_key = ?')
    .bind(key)
    .first<{ value: string }>();
  return Response.json({ key, value: row?.value ?? '' });
}

async function handleKvPut(request: Request, db: D1Database): Promise<Response> {
  const body = await readObject(request);
  if (body instanceof Response) return body;
  const key = bounded(body.key, KEY_MAX);
  if (!key || typeof body.value !== 'string' || body.value.length > VALUE_MAX) return badRequest();
  const type = body.type === undefined ? 'string' : body.type;
  const order = body.order === undefined ? 'any' : body.order;
  if (type !== 'string' && type !== 'number') return badRequest();
  if (order !== 'any' && order !== 'increase' && order !== 'decrease') return badRequest();
  if (type === 'number' && !isDecimalInteger(body.value)) return badRequest();

  const now = Date.now();
  const [written, current] = await db.batch<Record<string, unknown>>([
    db.prepare(KV_UPSERT).bind(key, body.value, now, order, order, type, type, order, type, type),
    db.prepare('SELECT value FROM kv_entries WHERE entry_key = ?').bind(key),
  ]);
  const row = firstRow(current);
  const value = typeof row?.value === 'string' ? row.value : '';
  return Response.json({ key, value, updated: changesOf(written) > 0 });
}

async function handleSince(request: Request, db: D1Database): Promise<Response> {
  const body = await readObject(request);
  if (body instanceof Response) return body;
  const scope = bounded(body.scope, ID_MAX);
  const targetId = bounded(body.targetId, ID_MAX);
  if (!scope || !targetId || typeof body.create !== 'boolean') return badRequest();

  const select = db
    .prepare(
      'SELECT scope, target_id, since_ms FROM notify_target_since WHERE scope = ? AND target_id = ?'
    )
    .bind(scope, targetId);

  let row: Record<string, unknown> | undefined;
  if (body.create) {
    const [, current] = await db.batch<Record<string, unknown>>([
      db
        .prepare(
          `INSERT INTO notify_target_since (scope, target_id, since_ms) VALUES (?, ?, ?)
           ON CONFLICT(scope, target_id) DO NOTHING`
        )
        .bind(scope, targetId, Date.now()),
      select,
    ]);
    row = firstRow(current);
  } else {
    const found = await select.first<Record<string, unknown>>();
    row = found ?? undefined;
  }
  if (!row || typeof row.since_ms !== 'number') return notFound();
  return Response.json({ scope, targetId, sinceMs: row.since_ms });
}

async function handleClaim(request: Request, db: D1Database): Promise<Response> {
  const body = await readObject(request);
  if (body instanceof Response) return body;
  const claimKey = bounded(body.claimKey, KEY_MAX);
  const clientId = bounded(body.clientId, ID_MAX);
  if (!claimKey || !clientId) return badRequest();

  const now = Date.now();
  const [, current] = await db.batch<{ owner_client_id: string; status: string }>([
    db.prepare(CLAIM_UPSERT).bind(claimKey, clientId, now + LEASE_MS, now),
    db
      .prepare('SELECT owner_client_id, status FROM notify_claims WHERE claim_key = ?')
      .bind(claimKey),
  ]);
  const row = firstRow(current);
  if (!row) return Response.json({ error: 'notify_failed' }, { status: 500 });
  return Response.json({
    granted: row.owner_client_id === clientId && row.status === 'leased',
    status: row.status,
  });
}

async function handleAck(request: Request, db: D1Database): Promise<Response> {
  const body = await readObject(request);
  if (body instanceof Response) return body;
  const claimKey = bounded(body.claimKey, KEY_MAX);
  const clientId = bounded(body.clientId, ID_MAX);
  if (!claimKey || !clientId) return badRequest();

  const [written] = await db.batch([
    db
      .prepare(
        `UPDATE notify_claims SET status = 'sent', updated_at = ?
         WHERE claim_key = ? AND owner_client_id = ? AND status = 'leased'`
      )
      .bind(Date.now(), claimKey, clientId),
  ]);
  return Response.json({ updated: changesOf(written) > 0 });
}

export async function handleNotifyRequest(
  request: Request,
  db: D1Database
): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname === '/api/kv' && request.method === 'GET') return handleKvGet(url, db);
  if (url.pathname === '/api/kv' && request.method === 'PUT') return handleKvPut(request, db);
  if (url.pathname === '/api/notify/since' && request.method === 'POST')
    return handleSince(request, db);
  if (url.pathname === '/api/notify/claim' && request.method === 'POST')
    return handleClaim(request, db);
  if (url.pathname === '/api/notify/ack' && request.method === 'POST')
    return handleAck(request, db);
  return null;
}
