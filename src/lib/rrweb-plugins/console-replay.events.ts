import type { eventWithTime } from '@rrweb/types';
import { CONSOLE_PLUGIN_NAME, type ConsoleLog, type ConsolePluginEvent } from './index';

export interface ConsoleReplayPluginOptions {
  onConsoleEvent?: (log: ConsoleLog, timestamp: number) => void;
}

export interface ReplayConsolePlugin {
  handler: (event: eventWithTime, isSync: boolean, context: { replayer: unknown }) => void;
}

interface PluginEventData {
  plugin: string;
  payload: ConsolePluginEvent;
}

export function isConsolePluginEvent(event: eventWithTime): boolean {
  return (
    event.type === 6 &&
    typeof event.data === 'object' &&
    event.data !== null &&
    'plugin' in event.data &&
    (event.data as { plugin: string }).plugin === CONSOLE_PLUGIN_NAME
  );
}

function getConsolePayload(event: eventWithTime): ConsolePluginEvent | null {
  if (!isConsolePluginEvent(event)) return null;
  const data = event.data as PluginEventData;
  return data.payload;
}

export function extractConsoleLogs(
  events: eventWithTime[]
): (ConsoleLog & { eventTimestamp: number })[] {
  const logs: (ConsoleLog & { eventTimestamp: number })[] = [];

  for (const event of events) {
    const payload = getConsolePayload(event);
    if (payload && payload.type === 'console') {
      logs.push({
        ...payload.data,
        eventTimestamp: event.timestamp,
      });
    }
  }

  return logs;
}

export function getReplayConsolePlugin(
  options: ConsoleReplayPluginOptions = {}
): ReplayConsolePlugin {
  const { onConsoleEvent } = options;

  return {
    handler(event, _isSync, _context) {
      const payload = getConsolePayload(event);
      if (payload && payload.type === 'console' && onConsoleEvent) {
        onConsoleEvent(payload.data, payload.timestamp);
      }
    },
  };
}
