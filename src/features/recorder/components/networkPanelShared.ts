import type { NetworkRequest, NetworkRequestPhase } from '@/lib/rrweb-plugins';
import type { eventWithTime } from '@rrweb/types';

export type NetworkRequestWithTimestamp = NetworkRequest & { eventTimestamp: number };

export interface NetworkPanelProps {
  events: eventWithTime[];
  currentTime?: number;
}

export type RequestStatus = 'past' | 'active' | 'future';

export function getPhaseIndicator(phase: NetworkRequestPhase | undefined): string {
  switch (phase) {
    case 'start':
      return '⏳';
    case 'response-headers':
      return '📥';
    case 'response-body':
      return '📦';
    case 'complete':
      return '✓';
    case 'error':
      return 'ERR';
    case 'abort':
      return '✗';
    default:
      return '...';
  }
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

export function getRequestStatus(
  request: NetworkRequestWithTimestamp,
  currentTime: number | undefined,
  recordingStartTime: number
): RequestStatus {
  if (currentTime === undefined) {
    return 'past';
  }

  const relativeTime = getRelativeTime(request.eventTimestamp, recordingStartTime);
  const duration = request.duration || 1000;

  if (currentTime < relativeTime - duration) {
    return 'future';
  }
  if (currentTime >= relativeTime - duration && currentTime <= relativeTime) {
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
