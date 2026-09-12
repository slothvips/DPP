import { useLiveQuery } from 'dexie-react-hooks';
import { Ban, CircleCheck, ListOrdered } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { type JenkinsQueueItemRecord, db } from '@/db';
import type { JenkinsQueueItem } from '@/features/jenkins/api/queue';
import {
  JenkinsBadge,
  JenkinsEmptyState,
  JenkinsPanel,
  JenkinsPanelHeader,
} from '@/features/jenkins/components/jenkinsUi';
import { JenkinsService } from '@/features/jenkins/service';
import { useConfirmDialog } from '@/utils/confirm-dialog';
import { logger } from '@/utils/logger';

const QUEUE_POLL_INTERVAL_MS = 3_000;
const EMPTY_QUEUE_ITEMS: JenkinsQueueItemRecord[] = [];

// In-memory snapshot so switching back to the queue tab renders instantly
// instead of flashing the empty state before the remote fetch returns.
let queueSnapshot: { envId: string | undefined; items: JenkinsQueueItem[] } | null = null;

const QUEUE_STATE_LABELS = {
  queued: '排队中',
  blocked: '已阻塞',
  executable: '已创建构建',
  cancelled: '已取消',
  expired: '已过期',
  unknown: '状态未知',
} as const;

interface QueueRow {
  queueId: string;
  state: JenkinsQueueItem['state'];
  why?: string;
  buildUrl?: string;
  jobUrl?: string;
  jobName?: string;
}

function fromRemote(item: JenkinsQueueItem): QueueRow {
  return {
    queueId: item.id,
    state: item.state,
    why: item.why,
    buildUrl: item.buildUrl,
    jobUrl: item.jobUrl,
    jobName: item.jobName,
  };
}

function fromRecord(record: JenkinsQueueItemRecord): QueueRow {
  return {
    queueId: record.queueId,
    state: record.state,
    why: record.why,
    buildUrl: record.buildId,
    jobUrl: record.jobUrl,
  };
}

export function JenkinsQueueSection({
  envId,
  active = true,
}: {
  envId?: string;
  active?: boolean;
}) {
  const { toast } = useToast();
  const { confirm } = useConfirmDialog();
  const [remoteItems, setRemoteItems] = useState<JenkinsQueueItem[] | null>(() =>
    queueSnapshot && queueSnapshot.envId === envId ? queueSnapshot.items : null
  );
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(remoteItems === null);

  const fallbackItems = useLiveQuery(
    () =>
      envId
        ? db.jenkinsQueueItems.where('envId').equals(envId).toArray()
        : Promise.resolve(EMPTY_QUEUE_ITEMS),
    [envId],
    EMPTY_QUEUE_ITEMS
  );

  const localActiveIds = fallbackItems
    .filter((item) => ['queued', 'blocked', 'unknown'].includes(item.state))
    .map((item) => item.queueId)
    .sort()
    .join(',');

  // Display source of truth: the live Jenkins queue.
  useEffect(() => {
    if (!active || !envId) return;
    let mounted = true;

    const load = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const list = await JenkinsService.fetchQueue(envId);
        if (!mounted) return;
        queueSnapshot = { envId, items: list };
        setRemoteItems(list);
        setStale(false);
      } catch (error) {
        if (!mounted) return;
        logger.warn('Jenkins queue fetch failed', error);
        setStale(true);
        setRemoteItems(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void load();
    };

    void load();
    const timer = setInterval(() => void load(), QUEUE_POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      mounted = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [active, envId]);

  // Bookkeeping only: keep locally tracked operations in sync with Jenkins.
  useEffect(() => {
    if (!active || !envId || !localActiveIds) return;
    const queueIds = localActiveIds.split(',');

    let mounted = true;
    const poll = async () => {
      await Promise.all(
        queueIds.map(async (queueId) => {
          try {
            await JenkinsService.getQueueItem(queueId, envId);
          } catch (error) {
            if (mounted) logger.warn('Jenkins queue polling failed', error);
          }
        })
      );
    };
    void poll();
    const timer = setInterval(() => void poll(), QUEUE_POLL_INTERVAL_MS);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [active, envId, localActiveIds]);

  const rows = useMemo<QueueRow[]>(() => {
    const source = remoteItems ? remoteItems.map(fromRemote) : fallbackItems.map(fromRecord);
    return source
      .sort((left, right) => {
        const diff = Number(left.queueId) - Number(right.queueId);
        return diff !== 0 ? diff : left.queueId.localeCompare(right.queueId);
      })
      .slice(0, 50);
  }, [remoteItems, fallbackItems]);

  async function handleCancel(queueId: string) {
    const confirmed = await confirm('确定要取消这个排队中的构建吗？', '确认取消排队', 'danger');
    if (!confirmed || !envId) return;
    try {
      await JenkinsService.cancelQueueItem(queueId, envId);
      toast('已发送取消排队请求', 'success');
    } catch (error) {
      logger.error('Cancel Jenkins queue item failed', error);
      toast('取消排队失败', 'error');
    }
  }

  return (
    <JenkinsPanel>
      <JenkinsPanelHeader
        icon={<ListOrdered className="h-4 w-4 text-primary" />}
        title="队列"
        badge={
          stale ? (
            <JenkinsBadge tone="danger" title="远端不可用，显示本地缓存">
              离线缓存
            </JenkinsBadge>
          ) : undefined
        }
      />
      {loading && remoteItems === null ? (
        <JenkinsEmptyState className="m-2">正在读取队列...</JenkinsEmptyState>
      ) : rows.length === 0 ? (
        <JenkinsEmptyState className="m-2">当前没有排队中的 Jenkins 构建</JenkinsEmptyState>
      ) : (
        <div className="grid min-h-0 flex-1 content-start gap-2 overflow-auto p-2">
          {rows.map((row) => (
            <div
              key={row.queueId}
              className="flex min-w-0 items-start justify-between gap-3 rounded-xl border border-border/50 px-3 py-2"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-mono">#{row.queueId}</span>
                  <span className="text-muted-foreground">{QUEUE_STATE_LABELS[row.state]}</span>
                  {row.buildUrl && (
                    <CircleCheck className="h-3.5 w-3.5 text-success" aria-label="已创建 Build" />
                  )}
                </div>
                {row.jobName && (
                  <p className="mt-0.5 truncate text-xs text-foreground" title={row.jobName}>
                    {row.jobName}
                  </p>
                )}
                {row.why && (
                  <p className="mt-1 break-words text-xs text-muted-foreground">{row.why}</p>
                )}
                {row.buildUrl && (
                  <a
                    className="mt-1 block truncate text-xs text-primary underline-offset-2 hover:underline"
                    href={row.buildUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    打开已创建 Build
                  </a>
                )}
              </div>
              {(row.state === 'queued' || row.state === 'blocked' || row.state === 'unknown') && (
                <button
                  type="button"
                  className="inline-flex shrink-0 items-center gap-1 text-xs text-destructive hover:underline"
                  onClick={() => void handleCancel(row.queueId)}
                >
                  <Ban className="h-3.5 w-3.5" />
                  取消
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </JenkinsPanel>
  );
}
