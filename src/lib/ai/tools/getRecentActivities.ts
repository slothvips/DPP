// Recent activities AI tool - query user operations from sync operations table
import type { RemoteActivityLog } from '@/db/types';
import { db, getRemoteActivities } from '@/lib/db';

type DetailLevel = 'summary' | 'detailed';

interface ActivityDescription {
  type: 'create' | 'update' | 'delete';
  table: string;
  timestamp: number;
  description: string;
  /** 操作来源：本地或远程 */
  source: 'local' | 'remote';
  /** 远程操作的客户端 ID，仅 source=remote 时有值 */
  clientId?: string;
  /** 详细信息，仅在 detailLevel=detailed 时返回 */
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

const TABLE_LABELS: Record<string, string> = {
  links: '链接',
  tags: '标签',
  blackboard: '便签',
  jobTags: 'Job 标签',
  linkTags: '链接标签',
};

function generateDescription(type: string, table: string, payload: unknown): string {
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

/** 生成详细信息 */
function generateDetails(
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
  const localOps = await db.operations.where('timestamp').between(startTime, now).toArray();

  // 查询远程操作记录
  const remoteOps = (await getRemoteActivities(startTime, now)) as RemoteActivityLog[];

  // 按类型和表统计
  const summary = {
    total: localOps.length + remoteOps.length,
    byType: { create: 0, update: 0, delete: 0 },
    byTable: {
      links: 0,
      tags: 0,
      blackboard: 0,
      jobTags: 0,
      linkTags: 0,
    },
  };

  const activities: ActivityDescription[] = [];

  // 处理本地操作
  for (const op of localOps) {
    // 统计
    if (op.type === 'create' || op.type === 'update' || op.type === 'delete') {
      summary.byType[op.type]++;
    }
    const opTable = op.table as keyof typeof summary.byTable;
    if (opTable in summary.byTable) {
      summary.byTable[opTable]++;
    }

    const activity: ActivityDescription = {
      type: op.type as 'create' | 'update' | 'delete',
      table: op.table,
      timestamp: op.timestamp,
      description: generateDescription(op.type, op.table, op.payload),
      source: 'local',
    };

    // 如果需要详细信息，添加 details 字段
    if (detailLevel === 'detailed') {
      activity.details = generateDetails(op.table, op.payload);
    }

    activities.push(activity);
  }

  // 处理远程操作
  for (const op of remoteOps) {
    // 统计
    if (op.type === 'create' || op.type === 'update' || op.type === 'delete') {
      summary.byType[op.type]++;
    }
    const opTable = op.table as keyof typeof summary.byTable;
    if (opTable in summary.byTable) {
      summary.byTable[opTable]++;
    }

    const activity: ActivityDescription = {
      type: op.type as 'create' | 'update' | 'delete',
      table: op.table,
      timestamp: op.timestamp,
      description: generateDescription(op.type, op.table, op.payload),
      source: 'remote',
      clientId: op.clientId,
    };

    // 如果需要详细信息，添加 details 字段
    if (detailLevel === 'detailed') {
      activity.details = generateDetails(op.table, op.payload);
    }

    activities.push(activity);
  }

  // 按时间倒序排列
  activities.sort((a, b) => b.timestamp - a.timestamp);

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
