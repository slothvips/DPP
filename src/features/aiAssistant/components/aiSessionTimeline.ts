import { differenceInCalendarDays } from 'date-fns';
import type { AISession } from '@/features/aiAssistant/types';

export type AISessionTimelineLabel = '已置顶' | '今天' | '昨天' | '近 7 天' | '近 30 天' | '更早';

export interface AISessionTimelineGroup {
  label: AISessionTimelineLabel;
  sessions: AISession[];
}

const TIMELINE_LABELS: AISessionTimelineLabel[] = [
  '已置顶',
  '今天',
  '昨天',
  '近 7 天',
  '近 30 天',
  '更早',
];

export function getSessionTimelineLabel(
  updatedAt: number,
  now = Date.now()
): AISessionTimelineLabel {
  const daysAgo = differenceInCalendarDays(new Date(now), new Date(updatedAt));
  if (daysAgo <= 0) return '今天';
  if (daysAgo === 1) return '昨天';
  if (daysAgo < 7) return '近 7 天';
  if (daysAgo < 30) return '近 30 天';
  return '更早';
}

export function groupSessionsByUpdatedAt(
  sessions: AISession[],
  now = Date.now()
): AISessionTimelineGroup[] {
  const groups = new Map<AISessionTimelineLabel, AISession[]>();
  const pinnedSessions = [...sessions]
    .filter((session) => session.pinnedAt !== undefined)
    .sort((left, right) => (right.pinnedAt ?? 0) - (left.pinnedAt ?? 0));
  if (pinnedSessions.length > 0) groups.set('已置顶', pinnedSessions);

  for (const session of [...sessions]
    .filter((session) => session.pinnedAt === undefined)
    .sort((left, right) => right.updatedAt - left.updatedAt)) {
    const label = getSessionTimelineLabel(session.updatedAt, now);
    const group = groups.get(label) ?? [];
    group.push(session);
    groups.set(label, group);
  }

  return TIMELINE_LABELS.flatMap((label) => {
    const groupedSessions = groups.get(label);
    return groupedSessions ? [{ label, sessions: groupedSessions }] : [];
  });
}
