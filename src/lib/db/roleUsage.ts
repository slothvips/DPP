import { db } from '@/db';

export interface RoleUsageStat {
  count: number;
  rate: number;
}

export async function recordRoleUsageForSession(sessionId: string): Promise<void> {
  const session = await db.aiSessions.get(sessionId);
  const roleId = session?.role?.roleId;
  if (!roleId) return;

  const eventId = `${sessionId}:${roleId}`;
  const existing = await db.roleUsageEvents.get(eventId);
  if (existing) return;

  const now = Date.now();
  await db.roleUsageEvents.add({
    id: eventId,
    roleId,
    sessionId,
    usedAt: now,
    updatedAt: now,
  });
}

export async function backfillRoleUsageEvents(): Promise<void> {
  const sessions = await db.aiSessions.toArray();
  const messages = await db.aiMessages.toArray();
  const usedSessionIds = new Set(
    messages.filter((message) => message.role === 'user').map((message) => message.sessionId)
  );

  for (const session of sessions) {
    if (usedSessionIds.has(session.id)) {
      await recordRoleUsageForSession(session.id);
    }
  }
}

export async function listRoleUsageStats(): Promise<Record<string, RoleUsageStat>> {
  const events = await db.roleUsageEvents.toArray();
  const counts = new Map<string, number>();
  for (const event of events) {
    counts.set(event.roleId, (counts.get(event.roleId) ?? 0) + 1);
  }

  const total = events.length;
  return Object.fromEntries(
    [...counts.entries()].map(([roleId, count]) => [
      roleId,
      { count, rate: total === 0 ? 0 : count / total },
    ])
  );
}
