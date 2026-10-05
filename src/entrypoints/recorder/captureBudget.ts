import type { eventWithTime } from '@rrweb/types';
import { CONSOLE_PLUGIN_NAME, NETWORK_PLUGIN_NAME } from '../../lib/rrweb-plugins/names.ts';

/** 单次录像里网络和控制台插件事件的条数上限。 */
export const MAX_PLUGIN_EVENTS = 4_000;

/** 单次录像里网络和控制台插件事件的估算字节上限。 */
export const MAX_PLUGIN_EVENT_BYTES = 4 * 1024 * 1024;

export interface RecordingCaptureBuffer {
  events: eventWithTime[];
  pluginEventCount: number;
  pluginEventBytes: number;
  pluginTruncated: boolean;
}

export function createRecordingCaptureBuffer(): RecordingCaptureBuffer {
  return {
    events: [],
    pluginEventCount: 0,
    pluginEventBytes: 0,
    pluginTruncated: false,
  };
}

export function isCapturePluginEvent(event: eventWithTime): boolean {
  if (event.type !== 6 || typeof event.data !== 'object' || event.data === null) {
    return false;
  }
  const plugin = (event.data as { plugin?: unknown }).plugin;
  return plugin === NETWORK_PLUGIN_NAME || plugin === CONSOLE_PLUGIN_NAME;
}

export function pushRecordingEvent(buffer: RecordingCaptureBuffer, event: eventWithTime): void {
  if (!isCapturePluginEvent(event)) {
    buffer.events.push(event);
    return;
  }

  if (buffer.pluginTruncated) {
    return;
  }

  const size = estimateEventBytes(event);
  const exceedsCount = buffer.pluginEventCount >= MAX_PLUGIN_EVENTS;
  const exceedsBytes = buffer.pluginEventBytes + size > MAX_PLUGIN_EVENT_BYTES;
  if (exceedsCount || exceedsBytes) {
    buffer.pluginTruncated = true;
    buffer.events.push(createCaptureTruncationEvent());
    return;
  }

  buffer.pluginEventCount += 1;
  buffer.pluginEventBytes += size;
  buffer.events.push(event);
}

function estimateEventBytes(event: eventWithTime): number {
  try {
    return JSON.stringify(event).length;
  } catch {
    return 1024;
  }
}

function createCaptureTruncationEvent(): eventWithTime {
  const timestamp = Date.now();
  return {
    type: 6,
    data: {
      plugin: CONSOLE_PLUGIN_NAME,
      payload: {
        type: 'console',
        timestamp,
        data: {
          id: 'capture-truncated',
          level: 'warn',
          args: ['[truncated] 录像中的网络和控制台事件已达到上限，后续插件事件已丢弃'],
          timestamp,
        },
      },
    },
    timestamp,
  };
}
