import type { NotifySubscriptions } from '@/db/typesDomain';
import { canonicalChatId } from './canonical.ts';
import { normalizeNotifySubscriptions } from './subscriptions.ts';

export interface NotifyDraftTarget {
  id: string;
  kind: string;
  label: string;
  chatId: string;
  subscriptions?: NotifySubscriptions;
}

export interface NotifyDraft {
  botToken: string;
  messageTemplate?: string;
  targets: NotifyDraftTarget[];
}

export interface SavedNotifyTarget {
  id: string;
  kind: 'user' | 'group';
  label: string;
  chatId: string;
  subscriptions?: NotifySubscriptions;
}

interface ExistingTarget {
  id: string;
  deletedAt?: number | null;
}

export interface SaveNotifyPorts {
  hasTeamSync(): Promise<boolean>;
  loadTargets(): Promise<ExistingTarget[]>;
  createSince(targetId: string): Promise<void>;
  write(next: {
    botToken: string;
    messageTemplate: string;
    targets: SavedNotifyTarget[];
  }): Promise<void>;
}

export async function saveNotifyConfigWith(
  draft: NotifyDraft,
  ports: SaveNotifyPorts
): Promise<void> {
  const targets: SavedNotifyTarget[] = [];
  for (const target of draft.targets) {
    const chatId = canonicalChatId(target.chatId);
    if (!chatId) throw new Error('chat_id 必须是数字');
    if (target.kind !== 'user' && target.kind !== 'group') throw new Error('接收对象类型无效');
    if (!target.id) throw new Error('接收对象缺少 id');
    const subscriptions = normalizeNotifySubscriptions(target.subscriptions);
    targets.push({
      id: target.id,
      kind: target.kind,
      label: target.label.trim(),
      chatId,
      ...(subscriptions ? { subscriptions } : {}),
    });
  }

  if (!(await ports.hasTeamSync())) {
    throw new Error('请先保存同步服务器地址和团队同步密钥');
  }

  const existingIds = new Set(
    (await ports.loadTargets())
      .filter((target) => target.deletedAt == null)
      .map((target) => target.id)
  );
  for (const target of targets) {
    if (!existingIds.has(target.id)) await ports.createSince(target.id);
  }
  await ports.write({
    botToken: draft.botToken.trim(),
    messageTemplate: draft.messageTemplate?.trim() ?? '',
    targets,
  });
}
