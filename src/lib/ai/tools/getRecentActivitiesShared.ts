import type { RemoteActivityLog } from '@/db/types';
import type { SyncOperation } from '@/lib/sync/types';

export type DetailLevel = 'summary' | 'detailed';

export interface ActivityDescription {
  type: 'create' | 'update' | 'delete';
  table: string;
  timestamp: number;
  description: string;
  source: 'local' | 'remote';
  clientId?: string;
  details?: {
    name?: string;
    url?: string;
    note?: string;
    color?: string;
    content?: string;
  };
}

export interface ActivitiesResult {
  period: {
    days: number;
    startTime: number;
    endTime: number;
  };
  summary: {
    total: number;
    byType: {
      create: number;
      update: number;
      delete: number;
    };
    byTable: {
      links: number;
      tags: number;
      blackboard: number;
      jobTags: number;
      linkTags: number;
    };
  };
  activities: ActivityDescription[];
}

export const TABLE_LABELS: Record<string, string> = {
  links: '链接',
  tags: '标签',
  blackboard: '便签',
  jobTags: 'Job 标签',
  linkTags: '链接标签',
};

export function generateActivityDescription(type: string, table: string, payload: unknown): string {
  const p = (payload as Record<string, unknown>) || {};
  const name = (p.name as string) || '';

  switch (type) {
    case 'create':
      if (table === 'links' && name) return `添加了链接 "${name}"`;
      if (table === 'tags' && name) return `创建了标签 "${name}"`;
      if (table === 'blackboard') return '添加了便签';
      return `创建了 ${TABLE_LABELS[table] || table}`;
    case 'update':
      if (table === 'links' && name) return `更新了链接 "${name}"`;
      if (table === 'tags' && name) return `更新了标签 "${name}"`;
      if (table === 'blackboard') return '更新了便签';
      return `更新了 ${TABLE_LABELS[table] || table}`;
    case 'delete':
      if (table === 'links') return '删除了链接';
      if (table === 'tags') return '删除了标签';
      if (table === 'blackboard') return '删除了便签';
      return `删除了 ${TABLE_LABELS[table] || table}`;
    default:
      return `${type} 了 ${TABLE_LABELS[table] || table}`;
  }
}

export function generateActivityDetails(
  table: string,
  payload: unknown
): ActivityDescription['details'] | undefined {
  const p = (payload as Record<string, unknown>) || {};

  switch (table) {
    case 'links':
      return {
        name: p.name as string,
        url: p.url as string,
        note: p.note as string,
      };
    case 'tags':
      return {
        name: p.name as string,
        color: p.color as string,
      };
    case 'blackboard':
      return {
        content: p.content as string,
      };
    default:
      return undefined;
  }
}

export function createActivitiesSummary(total: number): ActivitiesResult['summary'] {
  return {
    total,
    byType: { create: 0, update: 0, delete: 0 },
    byTable: {
      links: 0,
      tags: 0,
      blackboard: 0,
      jobTags: 0,
      linkTags: 0,
    },
  };
}

export function appendActivity(
  activities: ActivityDescription[],
  summary: ActivitiesResult['summary'],
  detailLevel: DetailLevel,
  op: Pick<SyncOperation, 'type' | 'table' | 'timestamp' | 'payload'> &
    Partial<Pick<RemoteActivityLog, 'clientId'>>,
  source: 'local' | 'remote'
) {
  const opType = op.type as 'create' | 'update' | 'delete';
  if (opType === 'create' || opType === 'update' || opType === 'delete') {
    summary.byType[opType]++;
  }

  const opTable = op.table as keyof ActivitiesResult['summary']['byTable'];
  if (opTable in summary.byTable) {
    summary.byTable[opTable]++;
  }

  const activity: ActivityDescription = {
    type: op.type as 'create' | 'update' | 'delete',
    table: op.table,
    timestamp: op.timestamp,
    description: generateActivityDescription(op.type, op.table, op.payload),
    source,
    ...(source === 'remote' && op.clientId ? { clientId: op.clientId } : {}),
  };

  if (detailLevel === 'detailed') {
    activity.details = generateActivityDetails(op.table, op.payload);
  }

  activities.push(activity);
}

export function sortActivitiesByTimeDesc(activities: ActivityDescription[]) {
  activities.sort((a, b) => b.timestamp - a.timestamp);
}

export type RemoteActivity = RemoteActivityLog;
