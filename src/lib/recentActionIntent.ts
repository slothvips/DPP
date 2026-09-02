import type { RecentAction } from '@/db';

const TOTP_REPLAY_INTENT_KEY = 'dpp_recent_totp_replay';

export function setTotpReplayIntent(action: RecentAction): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(TOTP_REPLAY_INTENT_KEY, JSON.stringify(action));
}

export function getTotpReplayIntent(): RecentAction | null {
  if (typeof sessionStorage === 'undefined') return null;

  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(TOTP_REPLAY_INTENT_KEY) ?? 'null');
    if (
      typeof value !== 'object' ||
      value === null ||
      !('type' in value) ||
      value.type !== 'totp_copy' ||
      !('targetId' in value) ||
      typeof value.targetId !== 'string'
    ) {
      return null;
    }

    return value as RecentAction;
  } catch {
    return null;
  }
}

export function clearTotpReplayIntent(): void {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(TOTP_REPLAY_INTENT_KEY);
  }
}
