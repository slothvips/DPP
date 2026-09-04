import { getRecordingById } from '@/lib/db';
import { extractConsoleLogs, extractNetworkRequests, formatClonedValue } from '@/lib/rrweb-plugins';
import { logger } from '@/utils/logger';
import { redactSensitiveFields, redactSensitiveText } from '@/utils/sensitive';
import { unpack } from '@rrweb/packer';
import type { eventWithTime } from '@rrweb/types';

export async function recorderInspect(args: {
  id: string;
  include?: 'all' | 'errors' | 'network' | 'summary';
  limit?: number;
}) {
  const recording = await getRecordingById(args.id);
  if (!recording) throw new Error('未找到录制记录');

  const events = normalizeEvents(recording.events);
  const consoleLogs = extractConsoleLogs(events);
  const networkRequests = extractNetworkRequests(events);
  const failedRequests = networkRequests.filter(
    (request) =>
      request.phase === 'error' || request.phase === 'abort' || (request.status ?? 0) >= 400
  );
  const errorLogs = consoleLogs.filter((log) => log.level === 'error' || log.level === 'warn');
  const include = args.include ?? 'summary';
  const limit = Math.min(Math.max(1, args.limit ?? 20), 50);

  return {
    recording: {
      id: recording.id,
      title: recording.title,
      url: redactSensitiveText(recording.url),
      created_at: recording.createdAt,
      duration_ms: recording.duration,
      event_count: events.length,
      file_size: recording.fileSize,
    },
    summary: {
      console: countConsoleLevels(consoleLogs),
      network_request_count: networkRequests.length,
      failed_request_count: failedRequests.length,
      pages: extractPageUrls(events).slice(0, 20),
    },
    ...(include === 'errors' || include === 'all'
      ? {
          console_errors: errorLogs.slice(0, limit).map((log) => ({
            level: log.level,
            timestamp: log.eventTimestamp,
            message: redactSensitiveText(
              log.args
                .map((arg) => formatClonedValue(redactSensitiveFields(arg)))
                .join(' ')
                .slice(0, 1_000)
            ),
            ...(log.stack ? { stack: redactSensitiveText(log.stack).slice(0, 2_000) } : {}),
          })),
          console_errors_truncated: errorLogs.length > limit,
        }
      : {}),
    ...(include === 'network' || include === 'all'
      ? {
          failed_requests: failedRequests.slice(0, limit).map((request) => ({
            method: request.method,
            url: redactSensitiveText(request.url),
            status: request.status,
            status_text: request.statusText,
            duration_ms: request.duration,
            phase: request.phase,
            ...(request.error ? { error: redactSensitiveText(request.error).slice(0, 1_000) } : {}),
          })),
          failed_requests_truncated: failedRequests.length > limit,
        }
      : {}),
  };
}

function normalizeEvents(events: unknown[]): eventWithTime[] {
  const firstEvent = events[0];
  const packed =
    typeof firstEvent === 'string' ||
    Array.isArray(firstEvent) ||
    (typeof firstEvent === 'object' && firstEvent !== null && !('type' in firstEvent));
  if (!packed) return events as eventWithTime[];
  try {
    return events.map((event) => unpack(event as string)) as eventWithTime[];
  } catch (error) {
    logger.warn('Failed to unpack recording events, assuming raw events:', error);
    return events as eventWithTime[];
  }
}

function countConsoleLevels(logs: ReturnType<typeof extractConsoleLogs>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const log of logs) counts[log.level] = (counts[log.level] || 0) + 1;
  return counts;
}

function extractPageUrls(events: eventWithTime[]): string[] {
  const urls = events.flatMap((event) => {
    if (event.type !== 4 || typeof event.data !== 'object' || event.data === null) return [];
    const href = (event.data as { href?: unknown }).href;
    return typeof href === 'string' ? [redactSensitiveText(href)] : [];
  });
  return [...new Set(urls)];
}
