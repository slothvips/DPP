import {
  ArrowDownToLine,
  Download,
  ExternalLink,
  LoaderCircle,
  Pause,
  Play,
  RefreshCw,
} from 'lucide-react';
import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { VirtualList, type VirtualListHandle } from '@/components/ui/virtual-list';
import type { MyBuildItem } from '@/db';
import { JenkinsService } from '@/features/jenkins/service';
import { logger } from '@/utils/logger';
import { redactSensitiveText } from '@/utils/sensitive';

interface JenkinsBuildLogDialogProps {
  build: MyBuildItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enabled?: boolean;
}

const LOG_POLL_INTERVAL_MS = 1_000;
const MAX_LOG_BYTES = 10 * 1024 * 1024;

export function JenkinsBuildLogDialog({
  build,
  open,
  onOpenChange,
  enabled = true,
}: JenkinsBuildLogDialogProps) {
  const [log, setLog] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [paused, setPaused] = useState(false);
  const [limited, setLimited] = useState(false);
  const [redacted, setRedacted] = useState(false);
  const [wrap, setWrap] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [retryId, setRetryId] = useState(0);
  const startRef = useRef(0);
  const byteCountRef = useRef(0);
  const moreDataRef = useRef(true);
  const listHandleRef = useRef<VirtualListHandle | null>(null);
  const redactedId = useId();
  const wrapId = useId();
  const { toast } = useToast();
  const handleErrorRef = useRef<(cause: unknown) => void>(() => {});

  useEffect(() => {
    handleErrorRef.current = (cause: unknown) => {
      logger.error('Failed to fetch Jenkins build log', cause);
      setError(cause instanceof Error ? cause.message : '日志加载失败');
      setLoading(false);
      setStreaming(false);
      toast('日志加载失败', 'error');
    };
  });

  useEffect(() => {
    if (!open || !enabled) return;
    startRef.current = 0;
    byteCountRef.current = 0;
    moreDataRef.current = true;
    setLog('');
    setError(null);
    setLoading(true);
    setStreaming(false);
    setPaused(false);
    setLimited(false);
    setRedacted(false);
    setAutoScroll(true);
  }, [build.id, enabled, open]);

  useEffect(() => {
    if (!enabled && open) onOpenChange(false);
  }, [enabled, onOpenChange, open]);

  useEffect(() => {
    if (!open || !enabled || paused || limited || !moreDataRef.current) return;
    let active = true;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      try {
        const chunk = await JenkinsService.getBuildLogChunk(build.id, startRef.current, build.env);
        if (!active) return;

        const chunkBytes = new TextEncoder().encode(chunk.text).length;
        if (byteCountRef.current + chunkBytes > MAX_LOG_BYTES) {
          setLimited(true);
          setLoading(false);
          setStreaming(false);
          return;
        }

        byteCountRef.current += chunkBytes;
        startRef.current = chunk.nextStart;
        moreDataRef.current = chunk.moreData;
        setLog((current) => current + chunk.text);
        setError(null);
        setLoading(false);
        setStreaming(chunk.moreData);
        if (chunk.moreData) {
          timeoutId = setTimeout(() => void poll(), LOG_POLL_INTERVAL_MS);
        }
      } catch (cause) {
        if (active) handleErrorRef.current(cause);
      }
    }

    void poll();
    return () => {
      active = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [build.env, build.id, enabled, limited, open, paused, retryId]);

  const deferredLog = useDeferredValue(log);
  const visibleLog = useMemo(
    () => (redacted ? redactSensitiveText(deferredLog) : deferredLog),
    [deferredLog, redacted]
  );
  const lines = useMemo(() => (visibleLog ? visibleLog.split(/\r?\n/) : []), [visibleLog]);

  useEffect(() => {
    if (!open || !autoScroll) return;
    listHandleRef.current?.scrollToBottom();
  }, [autoScroll, open, visibleLog]);

  function retry() {
    moreDataRef.current = true;
    setError(null);
    setLoading(true);
    setRetryId((value) => value + 1);
  }

  function downloadVisibleLog() {
    const url = URL.createObjectURL(new Blob([visibleLog], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${build.jobName.replace(/[^a-z0-9._-]+/gi, '-')}-${build.number}.log`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(85vh,48rem)] max-h-[calc(100vh-1rem)] w-[calc(100vw-1rem)] max-w-5xl flex-col gap-3 p-4">
        <DialogHeader className="min-w-0 pr-8">
          <DialogTitle className="truncate text-base" title={`${build.jobName} #${build.number}`}>
            {build.jobName} #{build.number}
          </DialogTitle>
          <DialogDescription>
            {error ||
              (limited
                ? '已达到 10 MiB 显示上限'
                : paused
                  ? '已暂停'
                  : `${byteCountRef.current.toLocaleString()} 字节${streaming ? '，持续更新中' : ''}`)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 border-b border-border pb-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPaused((value) => !value)}
            disabled={Boolean(error) || limited || (!loading && !streaming && !paused)}
            title={paused ? '继续读取日志' : '暂停读取日志'}
          >
            {paused ? <Play className="mr-2 h-4 w-4" /> : <Pause className="mr-2 h-4 w-4" />}
            {paused ? '继续' : '暂停'}
          </Button>
          {error && (
            <Button variant="outline" size="sm" onClick={retry}>
              <RefreshCw className="mr-2 h-4 w-4" />
              重试
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={downloadVisibleLog} disabled={!visibleLog}>
            <Download className="mr-2 h-4 w-4" />
            下载当前视图
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={`${build.id.replace(/\/$/, '')}/consoleText`} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Jenkins 完整日志
            </a>
          </Button>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id={wrapId}
                checked={wrap}
                onCheckedChange={(checked) => setWrap(checked === true)}
              />
              <Label htmlFor={wrapId} className="cursor-pointer text-xs font-normal">
                自动换行
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id={redactedId}
                checked={redacted}
                onCheckedChange={(checked) => setRedacted(checked === true)}
              />
              <Label htmlFor={redactedId} className="cursor-pointer text-xs font-normal">
                脱敏视图
              </Label>
            </div>
          </div>
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden rounded-md border border-border bg-muted/30 font-mono text-xs leading-5 text-foreground">
          {lines.length > 0 ? (
            <VirtualList
              items={lines}
              estimateSize={20}
              overscan={30}
              dynamicSize
              handleRef={listHandleRef}
              onScroll={setAutoScroll}
              containerClassName="h-full"
              renderItem={(line, index) => (
                <div
                  className={wrap ? 'flex items-start px-2' : 'flex min-w-max items-center px-2'}
                >
                  <span className="mr-3 w-10 shrink-0 select-none text-right text-muted-foreground">
                    {index + 1}
                  </span>
                  <span
                    className={
                      wrap ? 'min-w-0 flex-1 whitespace-pre-wrap break-words' : 'whitespace-pre'
                    }
                  >
                    {line || ' '}
                  </span>
                </div>
              )}
            />
          ) : (
            <div className="flex h-full items-center justify-center gap-2 text-muted-foreground">
              {loading && <LoaderCircle className="h-4 w-4 animate-spin" />}
              {loading ? '加载中...' : error ? '日志加载失败' : '暂无日志输出'}
            </div>
          )}
          {!autoScroll && lines.length > 0 && (
            <button
              type="button"
              className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full border border-border bg-background/95 px-2 py-1 text-xs shadow-sm hover:bg-accent"
              onClick={() => {
                setAutoScroll(true);
                listHandleRef.current?.scrollToBottom();
              }}
            >
              <ArrowDownToLine className="h-3.5 w-3.5" />
              跳到最新
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
