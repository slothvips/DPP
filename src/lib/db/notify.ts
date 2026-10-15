import { db } from '@/db';
import type { NotifyConfigRecord, NotifyTargetRecord } from '@/db/types';

export async function getNotifyConfig(): Promise<NotifyConfigRecord | undefined> {
  return db.notifyConfig.get('default');
}

export async function getNotifyBotToken(): Promise<string> {
  const config = await getNotifyConfig();
  return config?.botToken ?? '';
}

export async function listNotifyTargets(): Promise<NotifyTargetRecord[]> {
  return db.notifyTargets.toArray();
}

export async function listActiveNotifyTargets(): Promise<NotifyTargetRecord[]> {
  const rows = await listNotifyTargets();
  return rows
    .filter((row) => row.deletedAt == null)
    .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
}

export async function writeNotifyState(next: {
  botToken: string;
  messageTemplate?: string;
  targets: Array<Pick<NotifyTargetRecord, 'id' | 'kind' | 'label' | 'chatId' | 'subscriptions'>>;
}): Promise<void> {
  const now = Date.now();
  await db.transaction('rw', db.notifyConfig, db.notifyTargets, async () => {
    const current = await db.notifyConfig.get('default');
    await db.notifyConfig.put({
      id: 'default',
      botToken: next.botToken,
      messageTemplate: next.messageTemplate?.trim() ?? '',
      jenkinsBuildTemplate: current?.jenkinsBuildTemplate ?? '',
      updatedAt: now,
      ...(current?.deletedAt != null ? { deletedAt: current.deletedAt } : {}),
    });
    const active = await db.notifyTargets.filter((row) => row.deletedAt == null).toArray();
    const nextIds = new Set(next.targets.map((target) => target.id));
    for (const row of active) {
      if (!nextIds.has(row.id)) {
        await db.notifyTargets.update(row.id, { deletedAt: now, updatedAt: now });
      }
    }
    for (const target of next.targets) {
      await db.notifyTargets.put({ ...target, updatedAt: now });
    }
  });
}

/** 只改 Jenkins 构建模板，不动通道 Token、试发正文和接收对象。 */
export async function writeJenkinsBuildTemplate(template: string): Promise<void> {
  const current = await db.notifyConfig.get('default');
  const now = Date.now();
  await db.notifyConfig.put({
    id: 'default',
    botToken: current?.botToken ?? '',
    messageTemplate: current?.messageTemplate ?? '',
    jenkinsBuildTemplate: template.trim(),
    updatedAt: now,
    ...(current?.deletedAt != null ? { deletedAt: current.deletedAt } : {}),
  });
}
