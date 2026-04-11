import type { ClonedValue, ConsoleLog } from '@/lib/rrweb-plugins';
import type { eventWithTime } from '@rrweb/types';

export type ConsoleLogWithTimestamp = ConsoleLog & { eventTimestamp: number };
export type LogStatus = 'past' | 'active' | 'future';

export const LOG_LEVELS = ['log', 'info', 'warn', 'error', 'debug', 'trace'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export const EXPAND_CONTENT_THRESHOLD = 200;

export interface ConsolePanelProps {
  events: eventWithTime[];
  currentTime?: number;
}

export interface FormattedArgsProps {
  args: ClonedValue[];
  isFuture?: boolean;
  expanded?: boolean;
}

export interface FormattedValueProps {
  value: ClonedValue;
  isFuture?: boolean;
  expanded?: boolean;
}

export function getRecordingStartTime(events: eventWithTime[]): number {
  for (const event of events) {
    if (event.timestamp && event.timestamp > 0) {
      return event.timestamp;
    }
  }
  return 0;
}

export function getRelativeTime(eventTimestamp: number, recordingStartTime: number): number {
  return eventTimestamp - recordingStartTime;
}

export function getLogStatus(
  log: ConsoleLogWithTimestamp,
  currentTime: number | undefined,
  recordingStartTime: number
): LogStatus {
  if (currentTime === undefined) {
    return 'past';
  }

  const relativeTime = getRelativeTime(log.eventTimestamp, recordingStartTime);
  const activeWindow = 500;

  if (currentTime < relativeTime) {
    return 'future';
  }
  if (currentTime <= relativeTime + activeWindow) {
    return 'active';
  }
  return 'past';
}

export function formatTimePoint(eventTimestamp: number, recordingStartTime: number): string {
  const relativeMs = getRelativeTime(eventTimestamp, recordingStartTime);
  if (relativeMs < 0) {
    return '00:00.000';
  }

  const totalSeconds = Math.floor(relativeMs / 1000);
  const ms = Math.floor(relativeMs % 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

export function getLevelButtonStyle(level: LogLevel): string {
  switch (level) {
    case 'error':
      return 'bg-destructive/20 text-destructive hover:bg-destructive/30 dark:hover:bg-destructive/40';
    case 'warn':
      return 'bg-warning/20 text-warning hover:bg-warning/30 dark:hover:bg-warning/40';
    case 'info':
      return 'bg-info/20 text-info hover:bg-info/30 dark:hover:bg-info/40';
    case 'debug':
      return 'bg-console-debug/20 text-console-debug hover:bg-console-debug/30 dark:hover:bg-console-debug/40';
    case 'trace':
      return 'bg-muted text-foreground hover:bg-muted/80';
    default:
      return 'bg-muted text-foreground hover:bg-muted/80';
  }
}

export function getLogBackground(level: LogLevel): string {
  switch (level) {
    case 'error':
      return 'bg-destructive/5';
    case 'warn':
      return 'bg-warning/5';
    default:
      return '';
  }
}
