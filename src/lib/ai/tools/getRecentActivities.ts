// Recent activities AI tool - query user operations from sync operations table
import { getLocalOperations, getRemoteActivities } from '@/lib/db';
import {
  type ActivitiesResult,
  type DetailLevel,
  type RemoteActivity,
  appendActivity,
  createActivitiesSummary,
  sortActivitiesByTimeDesc,
} from './getRecentActivitiesShared';

export async function getRecentActivities({
  days,
  detailLevel = 'summary',
}: {
  days: number;
  detailLevel?: DetailLevel;
}): Promise<ActivitiesResult> {
  // 验证参数
  if (days < 1 || days > 15) {
    throw new Error('天数必须在 1-15 之间');
  }

  const now = Date.now();
  const startTime = now - days * 24 * 60 * 60 * 1000;

  // 查询本地操作记录
  const localOps = await getLocalOperations(startTime, now);

  // 查询远程操作记录
  const remoteOps = (await getRemoteActivities(startTime, now)) as RemoteActivity[];

  const summary = createActivitiesSummary(localOps.length + remoteOps.length);
  const activities = [] as ActivitiesResult['activities'];

  for (const op of localOps) {
    appendActivity(activities, summary, detailLevel, op, 'local');
  }

  for (const op of remoteOps) {
    appendActivity(activities, summary, detailLevel, op, 'remote');
  }

  sortActivitiesByTimeDesc(activities);

  return {
    period: {
      days,
      startTime,
      endTime: now,
    },
    summary,
    activities,
  };
}
