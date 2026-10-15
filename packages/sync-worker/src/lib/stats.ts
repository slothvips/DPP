export interface StatsEventInput {
  ts: number;
  module: string;
  action: string;
  value?: number;
  meta?: Record<string, string | number | boolean>;
}

export interface StatsBatchInput {
  v: number;
  instanceId: string;
  extVersion?: string;
  browser?: string;
  events: StatsEventInput[];
}

export interface StatsSummary {
  overview: { events: number; devices: number };
  byAction: Array<{
    day: string;
    module: string;
    action: string;
    count: number;
    totalValue: number;
  }>;
  byModule: Array<{ module: string; count: number; devices: number }>;
  dau: Array<{ day: string; devices: number }>;
  versions: Array<{ version: string; devices: number }>;
  browsers: Array<{ browser: string; devices: number }>;
}

const MAX_BODY_BYTES = 256 * 1024;
const MAX_EVENTS_PER_BATCH = 200;
const MAX_EVENTS_PER_HOUR = 5000;
const MAX_EVENTS_GLOBAL_PER_HOUR = 50_000;
const MAX_EVENTS_PER_IP_PER_HOUR = 20_000;
const RATE_LIMIT_WINDOW_MS = 60 * 60_000;
const NAME_PATTERN = /^[a-z][a-zA-Z0-9_]*$/;
const MAX_NAME_LENGTH = 64;
const MAX_META_ENTRIES = 16;
const MAX_META_VALUE_LENGTH = 64;
const INSTANCE_ID_PATTERN = /^[0-9a-fA-F-]{8,64}$/;
const UUID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export class StatsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StatsValidationError';
  }
}

export class StatsRateLimitError extends Error {
  constructor() {
    super('Too many events');
    this.name = 'StatsRateLimitError';
  }
}

function isValidName(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_NAME_LENGTH &&
    NAME_PATTERN.test(value)
  );
}

function sanitizeMeta(value: unknown): Record<string, string | number | boolean> | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new StatsValidationError('Invalid meta');
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > MAX_META_ENTRIES) {
    throw new StatsValidationError('Invalid meta: too many entries');
  }
  const sanitized: Record<string, string | number | boolean> = {};
  for (const [key, entryValue] of entries) {
    if (key.length === 0 || key.length > MAX_NAME_LENGTH) {
      throw new StatsValidationError('Invalid meta key');
    }
    if (typeof entryValue === 'string' && entryValue.length <= MAX_META_VALUE_LENGTH) {
      sanitized[key] = entryValue;
    } else if (typeof entryValue === 'number' && Number.isFinite(entryValue)) {
      sanitized[key] = entryValue;
    } else if (typeof entryValue === 'boolean') {
      sanitized[key] = entryValue;
    } else {
      throw new StatsValidationError('Invalid meta value');
    }
  }
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function sanitizeEvent(value: unknown): StatsEventInput {
  if (typeof value !== 'object' || value === null) {
    throw new StatsValidationError('Invalid event');
  }
  const record = value as Record<string, unknown>;
  if (!isValidName(record.module) || !isValidName(record.action)) {
    throw new StatsValidationError('Invalid module or action');
  }
  if (typeof record.ts !== 'number' || !Number.isFinite(record.ts)) {
    throw new StatsValidationError('Invalid event timestamp');
  }
  const event: StatsEventInput = {
    ts: Math.round(record.ts),
    module: record.module,
    action: record.action,
  };
  if (record.value !== undefined) {
    if (typeof record.value !== 'number' || !Number.isFinite(record.value)) {
      throw new StatsValidationError('Invalid event value');
    }
    event.value = record.value;
  }
  const meta = sanitizeMeta(record.meta);
  if (meta) event.meta = meta;
  return event;
}

/** 纯函数校验，便于单测。不信任客户端任何字段。 */
export function validateStatsBatch(raw: unknown): StatsBatchInput {
  if (typeof raw !== 'object' || raw === null) {
    throw new StatsValidationError('Invalid batch');
  }
  const record = raw as Record<string, unknown>;
  if (record.v !== 1) {
    throw new StatsValidationError('Invalid batch version');
  }
  if (
    typeof record.instanceId !== 'string' ||
    !INSTANCE_ID_PATTERN.test(record.instanceId) ||
    !UUID_PATTERN.test(record.instanceId)
  ) {
    throw new StatsValidationError('Invalid instance id');
  }
  if (!Array.isArray(record.events) || record.events.length === 0) {
    throw new StatsValidationError('Invalid events');
  }
  if (record.events.length > MAX_EVENTS_PER_BATCH) {
    throw new StatsValidationError('Too many events in batch');
  }

  const batch: StatsBatchInput = {
    v: 1,
    instanceId: record.instanceId,
    events: record.events.map(sanitizeEvent),
  };
  if (record.extVersion !== undefined) {
    if (typeof record.extVersion !== 'string' || record.extVersion.length > 32) {
      throw new StatsValidationError('Invalid ext version');
    }
    batch.extVersion = record.extVersion;
  }
  if (record.browser !== undefined) {
    if (typeof record.browser !== 'string' || !isValidName(record.browser)) {
      throw new StatsValidationError('Invalid browser');
    }
    batch.browser = record.browser;
  }
  return batch;
}

export async function parseStatsBatch(request: Request): Promise<StatsBatchInput> {
  const contentLengthHeader = request.headers.get('Content-Length');
  if (contentLengthHeader !== null) {
    const contentLength = Number(contentLengthHeader);
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      throw new StatsValidationError('Invalid batch: exceeds the maximum size');
    }
  }
  let rawText: string;
  try {
    rawText = await request.text();
  } catch {
    throw new StatsValidationError('Invalid JSON');
  }
  if (rawText.length > MAX_BODY_BYTES) {
    throw new StatsValidationError('Invalid batch: exceeds the maximum size');
  }
  let raw: unknown;
  try {
    raw = JSON.parse(rawText);
  } catch {
    throw new StatsValidationError('Invalid JSON');
  }
  return validateStatsBatch(raw);
}

const ipWindows = new Map<string, { count: number; resetAt: number }>();

export function assertUnderIpRateLimit(ip: string, eventCount: number, now: number): void {
  const key = ip || 'unknown';
  let window = ipWindows.get(key);
  if (!window || now >= window.resetAt) {
    window = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    ipWindows.set(key, window);
  }
  if (window.count + eventCount > MAX_EVENTS_PER_IP_PER_HOUR) {
    throw new StatsRateLimitError();
  }
  window.count += eventCount;

  if (ipWindows.size > 10_000) {
    for (const [storedIp, storedWindow] of ipWindows) {
      if (now >= storedWindow.resetAt) ipWindows.delete(storedIp);
    }
  }
}

export async function assertUnderRateLimit(
  db: D1Database,
  instanceId: string,
  now: number,
  eventCount: number
): Promise<void> {
  const since = now - RATE_LIMIT_WINDOW_MS;
  const [instanceRow, globalRow] = await Promise.all([
    db
      .prepare(
        'SELECT COUNT(*) AS count FROM stats_events WHERE instance_id = ? AND server_ts >= ?'
      )
      .bind(instanceId, since)
      .first<{ count: number }>(),
    db
      .prepare('SELECT COUNT(*) AS count FROM stats_events WHERE server_ts >= ?')
      .bind(since)
      .first<{ count: number }>(),
  ]);
  if ((instanceRow?.count ?? 0) + eventCount > MAX_EVENTS_PER_HOUR) {
    throw new StatsRateLimitError();
  }
  if ((globalRow?.count ?? 0) + eventCount > MAX_EVENTS_GLOBAL_PER_HOUR) {
    throw new StatsRateLimitError();
  }
}

export async function insertStatsBatch(
  db: D1Database,
  batch: StatsBatchInput,
  now: number
): Promise<number> {
  const statements = batch.events.map((event) =>
    db
      .prepare(
        `INSERT OR IGNORE INTO stats_events
           (instance_id, ext_version, browser, module, action, value, meta_json, client_ts, server_ts)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        batch.instanceId,
        batch.extVersion ?? null,
        batch.browser ?? null,
        event.module,
        event.action,
        event.value ?? null,
        event.meta ? JSON.stringify(event.meta) : null,
        event.ts,
        now
      )
  );
  await db.batch(statements);
  return batch.events.length;
}

function dayRangeToMillis(from: string, to: string): { start: number; end: number } {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T23:59:59.999Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
    throw new StatsValidationError('Invalid date range');
  }
  const maxSpan = 366 * 24 * 60 * 60_000;
  if (end - start > maxSpan) {
    throw new StatsValidationError('Invalid date range: exceeds one year');
  }
  return { start, end };
}

export async function queryStatsSummary(
  db: D1Database,
  from: string,
  to: string
): Promise<StatsSummary> {
  const { start, end } = dayRangeToMillis(from, to);

  const [overviewRow, byAction, byModule, dau, versions, browsers] = await Promise.all([
    db
      .prepare(
        `SELECT COUNT(*) AS events, COUNT(DISTINCT instance_id) AS devices
           FROM stats_events
          WHERE server_ts >= ? AND server_ts <= ?`
      )
      .bind(start, end)
      .first<{ events: number; devices: number }>(),
    db
      .prepare(
        `SELECT date(server_ts / 1000, 'unixepoch') AS day, module, action,
                COUNT(*) AS count, COALESCE(SUM(value), 0) AS totalValue
           FROM stats_events
          WHERE server_ts >= ? AND server_ts <= ?
          GROUP BY day, module, action
          ORDER BY day, module, action`
      )
      .bind(start, end)
      .all<StatsSummary['byAction'][number]>(),
    db
      .prepare(
        `SELECT module, COUNT(*) AS count, COUNT(DISTINCT instance_id) AS devices
           FROM stats_events
          WHERE server_ts >= ? AND server_ts <= ?
          GROUP BY module
          ORDER BY count DESC`
      )
      .bind(start, end)
      .all<StatsSummary['byModule'][number]>(),
    db
      .prepare(
        `SELECT date(server_ts / 1000, 'unixepoch') AS day, COUNT(DISTINCT instance_id) AS devices
           FROM stats_events
          WHERE server_ts >= ? AND server_ts <= ?
          GROUP BY day
          ORDER BY day`
      )
      .bind(start, end)
      .all<StatsSummary['dau'][number]>(),
    db
      .prepare(
        `SELECT COALESCE(ext_version, 'unknown') AS version, COUNT(DISTINCT instance_id) AS devices
           FROM stats_events
          WHERE server_ts >= ? AND server_ts <= ?
          GROUP BY ext_version
          ORDER BY devices DESC`
      )
      .bind(start, end)
      .all<StatsSummary['versions'][number]>(),
    db
      .prepare(
        `SELECT COALESCE(browser, 'unknown') AS browser, COUNT(DISTINCT instance_id) AS devices
           FROM stats_events
          WHERE server_ts >= ? AND server_ts <= ?
          GROUP BY browser
          ORDER BY devices DESC`
      )
      .bind(start, end)
      .all<StatsSummary['browsers'][number]>(),
  ]);

  return {
    overview: {
      events: Number(overviewRow?.events ?? 0),
      devices: Number(overviewRow?.devices ?? 0),
    },
    byAction: byAction.results ?? [],
    byModule: byModule.results ?? [],
    dau: dau.results ?? [],
    versions: versions.results ?? [],
    browsers: browsers.results ?? [],
  };
}
