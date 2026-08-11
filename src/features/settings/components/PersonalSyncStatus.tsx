import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, CloudUpload, Info } from 'lucide-react';
import { db } from '@/db';
import { isSoftDeleted } from '@/lib/db/softDelete';
import { PERSONAL_SYNC_TABLES, resolveDataScope } from '@/lib/sync/dataScope';
import type { SyncOperation } from '@/lib/sync/types';
import { cn } from '@/utils/cn';

async function loadPersonalSyncStatus() {
  const [personalKeySetting, pendingOps, totpCount] = await Promise.all([
    db.settings.get('personal_encryption_key'),
    db.operations.where('synced').equals(0).toArray() as Promise<SyncOperation[]>,
    db.totpAccounts.filter((item) => !isSoftDeleted(item)).count(),
  ]);

  const hasPersonalKey =
    typeof personalKeySetting?.value === 'string' && personalKeySetting.value.length > 0;

  const pendingPersonalPush = pendingOps.filter((op) => {
    try {
      return resolveDataScope(op) === 'personal';
    } catch {
      return PERSONAL_SYNC_TABLES.includes(op.table);
    }
  }).length;

  return {
    hasPersonalKey,
    pendingPersonalPush,
    localPersonalAccountCount: totpCount,
  };
}

interface PersonalSyncStatusProps {
  className?: string;
}

export function PersonalSyncStatus({ className }: PersonalSyncStatusProps) {
  const status = useLiveQuery(() => loadPersonalSyncStatus(), []);

  if (!status) {
    return null;
  }

  const { hasPersonalKey, pendingPersonalPush, localPersonalAccountCount } = status;

  if (!hasPersonalKey && localPersonalAccountCount === 0 && pendingPersonalPush === 0) {
    return (
      <div
        className={cn(
          'flex items-start gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-[11px] leading-5 text-muted-foreground',
          className
        )}
        data-testid="personal-sync-status-idle"
      >
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>未配置时，验证器等个人数据仅保存在本机。</span>
      </div>
    );
  }

  if (!hasPersonalKey) {
    return (
      <div
        className={cn(
          'flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-[11px] leading-5 text-foreground',
          className
        )}
        data-testid="personal-sync-status-missing-key"
      >
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
        <span>
          本地有 {localPersonalAccountCount} 个验证器账户
          {pendingPersonalPush > 0 ? `，另有 ${pendingPersonalPush} 条待推送个人变更` : ''}
          ，但尚未配置个人私钥，这些数据不会上传。
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-[11px] leading-5 text-muted-foreground',
        className
      )}
      data-testid="personal-sync-status-ready"
    >
      <CloudUpload className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
      <span>
        个人同步已就绪（本地验证器 {localPersonalAccountCount} 个）
        {pendingPersonalPush > 0
          ? `；待推送个人变更 ${pendingPersonalPush} 条，将在下次同步时上传。`
          : '；暂无待推送的个人变更。'}
      </span>
    </div>
  );
}
