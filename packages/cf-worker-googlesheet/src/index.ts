import { D1SyncStore, SyncConflictError, SyncValidationError } from './lib/d1';
import type { SyncOperation } from './lib/d1';
import { SyncPushCoordinator } from './lib/pushCoordinator';
import { RequestTooLargeError, parsePushRequest } from './lib/requestValidation';
import {
  StatsRateLimitError,
  StatsValidationError,
  assertUnderIpRateLimit,
  assertUnderRateLimit,
  insertStatsBatch,
  parseStatsBatch,
  queryStatsSummary,
} from './lib/stats';
import { renderStatsDashboard } from './lib/statsDashboard';

interface WorkerEnv extends Env {
  SYNC_ACCESS_TOKEN: string;
  /** 统计管理的独立密钥：仅管理员持有，与同步 token 互不影响 */
  STATS_ADMIN_TOKEN?: string;
}

/**
 * 内置统计看板的内部路径：故意不可猜测，仅管理员知晓。
 * 不索引、不链接；HTML 壳不含数据，数据接口还需独立的 STATS_ADMIN_TOKEN。
 */
const STATS_DASHBOARD_PATH = '/internal/usage-insights-7c4a9f';

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

/**
 * 统计聚合查询：仅认 STATS_ADMIN_TOKEN（独立于同步 token）。
 * 团队成员即使持有 SYNC_ACCESS_TOKEN 也无法访问统计。
 */
async function handleStatsSummary(request: Request, env: WorkerEnv): Promise<Response> {
  if (!env.STATS_ADMIN_TOKEN) {
    return Response.json({ error: 'Stats admin token not configured' }, { status: 500 });
  }
  const provided = request.headers.get('X-Stats-Admin-Token') ?? '';
  if (!(await tokensMatch(provided, env.STATS_ADMIN_TOKEN))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = new URL(request.url);
  const from = url.searchParams.get('from') ?? '';
  const to = url.searchParams.get('to') ?? '';
  try {
    return Response.json(await queryStatsSummary(env.DB, from, to));
  } catch (error) {
    if (error instanceof StatsValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json({ error: 'Summary failed' }, { status: 500 });
  }
}

/**
 * 匿名统计上报：无需 SYNC_ACCESS_TOKEN，独立校验 + 限流。
 */
async function handleStatsIngest(request: Request, env: WorkerEnv): Promise<Response> {
  try {
    const batch = await parseStatsBatch(request);
    const now = Date.now();
    const ip = request.headers.get('CF-Connecting-IP') ?? '';
    assertUnderIpRateLimit(ip, batch.events.length, now);
    await assertUnderRateLimit(env.DB, batch.instanceId, now, batch.events.length);
    const received = await insertStatsBatch(env.DB, batch, now);
    return Response.json({ ok: true, received });
  } catch (error) {
    if (error instanceof StatsRateLimitError) {
      return Response.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }
    if (error instanceof StatsValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json({ error: 'Ingest failed' }, { status: 500 });
  }
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
      return url.pathname === '/'
        ? new Response('DPP Sync Worker')
        : Response.json({ status: 'ok' });
    }
    // 匿名统计上报：无需 SYNC_ACCESS_TOKEN，独立校验 + 限流。
    if (request.method === 'POST' && url.pathname === '/api/stats/events') {
      return handleStatsIngest(request, env);
    }
    // 统计聚合查询：与同步接口完全隔离，只认独立的 STATS_ADMIN_TOKEN。
    if (request.method === 'GET' && url.pathname === '/api/stats/summary') {
      return handleStatsSummary(request, env);
    }
    // 管理员的内置统计看板：仅暴露于不可猜测的内部路径，扩展与公开页面均不引用。
    // HTML 本身不含任何数据，页面内输入的 STATS_ADMIN_TOKEN 经请求头访问 summary API。
    if (request.method === 'GET' && url.pathname === STATS_DASHBOARD_PATH) {
      return new Response(renderStatsDashboard(), {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'no-referrer',
          'X-Robots-Tag': 'noindex, nofollow',
          'Content-Security-Policy':
            "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'",
        },
      });
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
