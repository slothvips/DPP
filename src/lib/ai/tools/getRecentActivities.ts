// Recent activities AI tool - query user operations from sync operations table
import {
  countLocalOperations,
  countRemoteActivities,
  getLocalOperations,
  getRemoteActivities,
} from '@/lib/db';
import {
  type ActivitiesResult,
  type DetailLevel,
  appendActivity,
  createActivitiesSummary,
  sortActivitiesByTimeDesc,
} from './getRecentActivitiesShared';

// Keep tool messages small enough for the chat renderer and provider context window.
const SUMMARY_ACTIVITY_LIMIT = 100;
const DETAILED_ACTIVITY_LIMIT = 50;

export async function getRecentActivities({
  days,
  detailLevel = 'summary',
}: {
  days: number;
  detailLevel?: DetailLevel;
}): Promise<ActivitiesResult> {
  // 验证参数
  if (!Number.isInteger(days) || days < 1 || days > 15) {
    throw new Error('天数必须在 1-15 之间');
  }

  const now = Date.now();
  const startTime = now - days * 24 * 60 * 60 * 1000;

  const activityLimit =
    detailLevel === 'detailed' ? DETAILED_ACTIVITY_LIMIT : SUMMARY_ACTIVITY_LIMIT;
  // Fetch only the newest records while counting the full range separately. This avoids
  // materializing thousands of operation payloads just to answer a "recent" query.
  const [localOps, remoteOps, localTotal, remoteTotal] = await Promise.all([
    getLocalOperations(startTime, now, activityLimit),
    getRemoteActivities(startTime, now, activityLimit),
    countLocalOperations(startTime, now),
    countRemoteActivities(startTime, now),
  ]);

  const summary = createActivitiesSummary(localOps.length + remoteOps.length);
  const activities = [] as ActivitiesResult['activities'];

  for (const op of localOps) {
    appendActivity(activities, summary, detailLevel, op, 'local');
  }

  for (const op of remoteOps) {
    appendActivity(activities, summary, detailLevel, op, 'remote');
  }

  sortActivitiesByTimeDesc(activities);
  const total = localTotal + remoteTotal;
  const boundedActivities = activities.slice(0, activityLimit);

  return {
    period: {
      days,
      startTime,
      endTime: now,
    },
    summary: { ...summary, total },
    activities: boundedActivities,
    returned: boundedActivities.length,
    truncated: total > boundedActivities.length,
  };
}
