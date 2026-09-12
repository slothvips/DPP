import { db } from '@/db';
import type { JenkinsMetricSnapshot } from '@/db';
import { logger } from '@/utils/logger';

function createEmptyJenkinsMetrics(): JenkinsMetricSnapshot {
  return {
    requests: { total: 0, failed: 0, byCode: {} },
    cache: { jobs: 0, builds: 0 },
    queue: { polls: 0, cancellations: 0 },
    logs: { chunks: 0, bytes: 0 },
    updatedAt: 0,
  };
}

let pending = createEmptyJenkinsMetrics();

function addSnapshot(
  base: JenkinsMetricSnapshot,
  delta: JenkinsMetricSnapshot
): JenkinsMetricSnapshot {
  const byCode = { ...base.requests.byCode };
  for (const [code, count] of Object.entries(delta.requests.byCode)) {
    byCode[code] = (byCode[code] ?? 0) + count;
  }
  return {
    requests: {
      total: base.requests.total + delta.requests.total,
      failed: base.requests.failed + delta.requests.failed,
      byCode,
    },
    cache: {
      jobs: base.cache.jobs + delta.cache.jobs,
      builds: base.cache.builds + delta.cache.builds,
    },
    queue: {
      polls: base.queue.polls + delta.queue.polls,
      cancellations: base.queue.cancellations + delta.queue.cancellations,
    },
    logs: {
      chunks: base.logs.chunks + delta.logs.chunks,
      bytes: base.logs.bytes + delta.logs.bytes,
    },
    updatedAt: Math.max(base.updatedAt, delta.updatedAt),
  };
}

export function recordJenkinsRequest(outcome: { ok: boolean; code?: string }): void {
  pending.requests.total += 1;
  if (!outcome.ok) {
    pending.requests.failed += 1;
    const code = outcome.code ?? 'unknown';
    pending.requests.byCode[code] = (pending.requests.byCode[code] ?? 0) + 1;
  }
  pending.updatedAt = Date.now();
}

export function recordJenkinsCache(kind: 'jobs' | 'builds', count: number): void {
  if (count <= 0) return;
  pending.cache[kind] += count;
  pending.updatedAt = Date.now();
}

export function recordJenkinsQueue(action: 'poll' | 'cancel'): void {
  if (action === 'poll') pending.queue.polls += 1;
  else pending.queue.cancellations += 1;
  pending.updatedAt = Date.now();
}

export function recordJenkinsLogChunk(bytes: number): void {
  pending.logs.chunks += 1;
  pending.logs.bytes += Math.max(0, bytes);
  pending.updatedAt = Date.now();
}

let flushChain: Promise<void> = Promise.resolve();

export function flushJenkinsMetrics(envId: string): Promise<void> {
  if (!envId || pending.updatedAt === 0) return flushChain;
  const delta = pending;
  pending = createEmptyJenkinsMetrics();
  flushChain = flushChain
    .then(() => persistJenkinsMetricsDelta(envId, delta))
    .catch((error: unknown) => {
      logger.warn('Failed to flush Jenkins metrics', error);
    });
  return flushChain;
}

async function persistJenkinsMetricsDelta(
  envId: string,
  delta: JenkinsMetricSnapshot
): Promise<void> {
  try {
    await db.transaction('rw', db.jenkinsSyncState, async () => {
      const existing = await db.jenkinsSyncState.get(envId);
      const base = existing?.metrics ?? createEmptyJenkinsMetrics();
      await db.jenkinsSyncState.put({
        ...existing,
        envId,
        status: existing?.status ?? 'idle',
        metrics: addSnapshot(base, delta),
      });
    });
  } catch (error) {
    // Keep the delta so a later flush does not silently drop observations.
    pending = addSnapshot(delta, pending);
    throw error;
  }
}
