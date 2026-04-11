import { db } from '@/db';
import { extractConsoleLogs, extractNetworkRequests } from '@/lib/rrweb-plugins';
import { logger } from '@/utils/logger';
import { unpack } from '@rrweb/packer';
import type { eventWithTime } from '@rrweb/types';

export interface RRWebEvent {
  type: number;
  timestamp: number;
  data: unknown;
}

export interface LoadedPlayerData {
  title: string;
  events: eventWithTime[];
  networkRequestCount: number;
  consoleLogCount: number;
}

export function getSavedPanelSize(): number {
  const saved = localStorage.getItem('player-side-panel-width');
  return saved ? Number(saved) : 400;
}

export function savePanelSize(sizes: number[]) {
  if (sizes.length === 2 && sizes[1] > 0) {
    localStorage.setItem('player-side-panel-width', String(Math.round(sizes[1])));
  }
}

export function formatPlaybackTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function needsUnpack(events: RRWebEvent[]): boolean {
  const firstEvent = events[0] as unknown;
  return (
    typeof firstEvent === 'string' ||
    Array.isArray(firstEvent) ||
    (typeof firstEvent === 'object' && firstEvent !== null && !('type' in firstEvent))
  );
}

function normalizeEvents(events: RRWebEvent[]): eventWithTime[] {
  if (!needsUnpack(events)) {
    return events as eventWithTime[];
  }

  try {
    return events.map((event) => unpack(event as unknown as string)) as eventWithTime[];
  } catch (error) {
    logger.warn('Failed to unpack events, assuming raw:', error);
    return events as eventWithTime[];
  }
}

async function loadEventsByRecordingId(
  id: string
): Promise<{ title: string; events: RRWebEvent[] }> {
  const recording = await db.recordings.get(id);
  if (!recording) {
    throw new Error('未找到录制记录');
  }

  return {
    title: recording.title,
    events: recording.events as unknown as RRWebEvent[],
  };
}

async function loadEventsByCacheId(
  cacheId: string
): Promise<{ title: string; events: RRWebEvent[] }> {
  const response = (await browser.runtime.sendMessage({
    type: 'REMOTE_RECORDING_GET',
    payload: { cacheId },
  })) as {
    success: boolean;
    data?: { events?: unknown[]; title?: string };
    error?: string;
  };

  if (!response.success || !response.data?.events) {
    throw new Error(response.error || '加载缓存录制失败');
  }

  return {
    title: response.data.title || '远程录制',
    events: response.data.events as RRWebEvent[],
  };
}

async function loadEventsByUrl(url: string): Promise<{ title: string; events: RRWebEvent[] }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('加载录制文件失败');
  }

  return {
    title: '外部录制',
    events: (await response.json()) as RRWebEvent[],
  };
}

export async function loadPlayerDataFromLocation(search: string): Promise<LoadedPlayerData | null> {
  const params = new URLSearchParams(search);
  const id = params.get('id');
  const url = params.get('url');
  const cacheId = params.get('cache');

  let loaded: { title: string; events: RRWebEvent[] } | null = null;

  if (id) {
    loaded = await loadEventsByRecordingId(id);
  } else if (cacheId) {
    loaded = await loadEventsByCacheId(cacheId);
  } else if (url) {
    loaded = await loadEventsByUrl(url);
  }

  if (!loaded) {
    return null;
  }

  if (loaded.events.length === 0) {
    throw new Error('录制内容为空 (0 个事件)');
  }

  const events = normalizeEvents(loaded.events);

  return {
    title: loaded.title,
    events,
    networkRequestCount: extractNetworkRequests(events).length,
    consoleLogCount: extractConsoleLogs(events).length,
  };
}
