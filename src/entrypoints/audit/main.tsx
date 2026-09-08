import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CalendarDays,
  DatabaseZap,
  History,
  Layers3,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import 'virtual:uno.css';
import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ToastProvider, useToast } from '@/components/ui/toast';
import { VirtualList } from '@/components/ui/virtual-list';
import { loadAuditHistory } from '@/features/audit/auditHistory';
import { useTheme } from '@/hooks/useTheme';
import {
  AUDIT_TABLES,
  type AuditAction,
  type AuditEntityType,
  type AuditEntry,
  type AuditSource,
  type AuditTable,
  getAuditEntryType,
} from '@/lib/sync/auditHistoryModel';
import { logger } from '@/utils/logger';
import '@unocss/reset/tailwind.css';

const TABLE_LABELS: Record<AuditTable, string> = {
  blackboard: '黑板',
  jobTags: 'Job 标签',
  links: '链接',
  linkTags: '链接标签',
  materials: '物料',
  tags: '标签',
  testRuns: '测试执行',
  testProjects: '测试项目',
  projectRuns: '项目执行',
  totpAccounts: '验证器',
};

const ENTITY_TYPE_LABELS: Record<AuditEntityType, string> = {
  ...TABLE_LABELS,
  unavailable: '无法解密',
  prompt: '提示词',
  role: '角色',
  testCase: '测试用例',
  conversation: '会话',
};

const ACTION_LABELS: Record<AuditAction, string> = {
  create: '新增',
  update: '更新',
  delete: '删除',
  restore: '恢复',
  unavailable: '无法解密',
};

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function formatTime(timestamp: number) {
  return DATE_TIME_FORMATTER.format(timestamp);
}

type DateRangePreset = 'all' | 'today' | 'last7Days' | 'last30Days' | 'custom';

const DATE_RANGE_PRESETS: readonly { id: DateRangePreset; label: string; days?: number }[] = [
  { id: 'all', label: '全部时间' },
  { id: 'today', label: '今天', days: 1 },
  { id: 'last7Days', label: '最近 7 天', days: 7 },
  { id: 'last30Days', label: '最近 30 天', days: 30 },
];

function formatDateInput(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function getDateRange(days: number) {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - days + 1);
  return { startDate: formatDateInput(start), endDate: formatDateInput(end) };
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function getEntrySummary(entry: AuditEntry) {
  if (entry.unavailable) return `无法解密 · ${String(entry.key)}`;
  const payload = getRecord(entry.after);
  const value =
    payload?.name ?? payload?.title ?? payload?.label ?? payload?.content ?? payload?.status;
  if (typeof value === 'string' && value.trim()) return value.trim().replace(/\s+/g, ' ');
  return `${ENTITY_TYPE_LABELS[getAuditEntryType(entry)]} · ${String(entry.key)}`;
}

function ActionIcon({ type }: { type: AuditAction }) {
  if (type === 'create') return <Plus className="h-3.5 w-3.5" />;
  if (type === 'update') return <Pencil className="h-3.5 w-3.5" />;
  if (type === 'restore') return <RotateCcw className="h-3.5 w-3.5" />;
  if (type === 'unavailable') return <DatabaseZap className="h-3.5 w-3.5" />;
  return <Trash2 className="h-3.5 w-3.5" />;
}

interface AuditBlockItem {
  entry: AuditEntry;
  sequence: number;
}

const BLOCK_HEIGHT = 304;
const BLOCK_ROW_HEIGHT = 364;

function AuditBlock({
  item: { entry, sequence },
  direction,
  horizontalConnector,
  verticalConnector,
}: {
  item: AuditBlockItem;
  direction: 'right' | 'left';
  horizontalConnector: boolean;
  verticalConnector: boolean;
}) {
  const actionColor =
    entry.action === 'create'
      ? 'border-success/40 bg-success/10 text-success'
      : entry.action === 'delete'
        ? 'border-destructive/40 bg-destructive/10 text-destructive'
        : entry.action === 'restore'
          ? 'border-primary/40 bg-primary/10 text-primary'
          : 'border-warning/40 bg-warning/10 text-warning';

  return (
    <div className="relative min-w-0" style={{ height: `${BLOCK_ROW_HEIGHT}px` }}>
      {horizontalConnector && (
        <>
          <div className="absolute left-full top-[151px] z-0 w-10 border-t-2 border-border" />
          {direction === 'right' ? (
            <ArrowLeft className="absolute left-[calc(100%+12px)] top-[143px] z-20 h-4 w-4 bg-background text-muted-foreground" />
          ) : (
            <ArrowRight className="absolute left-[calc(100%+12px)] top-[143px] z-20 h-4 w-4 bg-background text-muted-foreground" />
          )}
        </>
      )}
      {verticalConnector && (
        <>
          <div className="absolute left-1/2 top-[304px] z-0 h-[60px] border-l-2 border-border" />
          <ArrowUp className="absolute left-1/2 top-[326px] z-20 h-4 w-4 -translate-x-1/2 bg-background text-muted-foreground" />
        </>
      )}

      <article
        className="relative z-10 flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm"
        style={{ height: `${BLOCK_HEIGHT}px` }}
        aria-label={`区块 ${sequence}，${ENTITY_TYPE_LABELS[getAuditEntryType(entry)]}${ACTION_LABELS[entry.action]}`}
      >
        <header className="flex min-w-0 items-center justify-between gap-2 border-b border-border px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 font-mono text-[11px] font-semibold text-muted-foreground">
              BLOCK #{sequence}
            </span>
            <span
              className={`inline-flex shrink-0 items-center gap-1 border px-1.5 py-0.5 text-xs ${actionColor}`}
            >
              <ActionIcon type={entry.action} />
              {ACTION_LABELS[entry.action]}
            </span>
            {entry.isChunked && (
              <span className="inline-flex shrink-0 items-center gap-1 border border-primary/35 bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                <Layers3 className="h-3.5 w-3.5" />
                分片合并
              </span>
            )}
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            {entry.source === 'local' ? '本机' : '其他设备'}
          </span>
        </header>

        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 border-b border-border px-3 py-2 text-xs">
          <span className="text-muted-foreground">类型</span>
          <span className="truncate font-medium">
            {ENTITY_TYPE_LABELS[getAuditEntryType(entry)]}
          </span>
          <span className="text-muted-foreground">摘要</span>
          <span className="truncate">{getEntrySummary(entry)}</span>
          <span className="text-muted-foreground">时间</span>
          <time className="truncate">{formatTime(entry.serverTimestamp ?? entry.timestamp)}</time>
          <span className="text-muted-foreground">操作 ID</span>
          <span className="truncate font-mono text-[11px]" title={entry.id}>
            {entry.id}
          </span>
          <span className="text-muted-foreground">设备 ID</span>
          <span className="truncate font-mono text-[11px]" title={entry.clientId}>
            {entry.clientId ?? 'unknown'}
          </span>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
            <span>解密数据</span>
            <span>{entry.isChunked ? '已重组完整载荷' : '完整载荷'}</span>
          </div>
          <pre className="min-h-0 flex-1 overflow-auto border-t border-border/70 bg-background/55 p-3 font-mono text-[11px] leading-4 text-foreground">
            {JSON.stringify(entry.after, null, 2)}
          </pre>
        </div>
      </article>
    </div>
  );
}

function AuditBlockRow({
  items,
  rowIndex,
  columnCount,
  hasNextRow,
}: {
  items: AuditBlockItem[];
  rowIndex: number;
  columnCount: number;
  hasNextRow: boolean;
}) {
  const direction = rowIndex % 2 === 0 ? 'right' : 'left';
  const visualItems = direction === 'right' ? items : [...items].reverse();
  const verticalConnectorIndex = direction === 'right' ? visualItems.length - 1 : 0;

  return (
    <div
      className="grid min-w-0 gap-10 px-4 sm:px-6"
      style={{
        gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
        height: `${BLOCK_ROW_HEIGHT}px`,
      }}
    >
      {visualItems.map((item, visualIndex) => (
        <div
          key={item.entry.id}
          className="min-w-0"
          style={
            direction === 'left' && visualIndex === 0
              ? { gridColumnStart: columnCount - visualItems.length + 1 }
              : undefined
          }
        >
          <AuditBlock
            item={item}
            direction={direction}
            horizontalConnector={visualIndex < visualItems.length - 1}
            verticalConnector={hasNextRow && visualIndex === verticalConnectorIndex}
          />
        </div>
      ))}
    </div>
  );
}

function getColumnCount(width: number) {
  if (width >= 1600) return 4;
  if (width >= 1200) return 3;
  if (width >= 720) return 2;
  return 1;
}

function useAuditColumnCount() {
  const [columnCount, setColumnCount] = useState(() => getColumnCount(window.innerWidth));

  useEffect(() => {
    function handleResize() {
      setColumnCount(getColumnCount(window.innerWidth));
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return columnCount;
}

function AuditApp() {
  const { theme } = useTheme();
  const { toast } = useToast();
  const toastRef = useRef(toast);
  const controllerRef = useRef<AbortController | null>(null);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedRows, setLoadedRows] = useState(0);
  const [error, setError] = useState<string>();
  const [search, setSearch] = useState('');
  const [tableFilter, setTableFilter] = useState<AuditTable | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<AuditAction | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<AuditSource | 'all'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('all');
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const columnCount = useAuditColumnCount();
  toastRef.current = toast;

  const loadHistory = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    setLoadedRows(0);
    setEntries([]);
    setError(undefined);

    try {
      const result = await loadAuditHistory({
        signal: controller.signal,
        onProgress: setLoadedRows,
      });
      if (controller.signal.aborted) return;
      setEntries(result.entries);
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
      const rawMessage = loadError instanceof Error ? loadError.message : '加载审计历史失败';
      const message =
        rawMessage === 'Sync server URL not configured'
          ? '请先在设置中配置同步服务器地址'
          : rawMessage;
      logger.error('[Audit] Failed to load history:', loadError);
      setError(message);
      toastRef.current(message, 'error');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
    return () => {
      controllerRef.current?.abort();
    };
  }, [loadHistory]);

  const filteredEntries = useMemo(() => {
    const start = startDate ? new Date(`${startDate}T00:00:00`).getTime() : 0;
    const end = endDate ? new Date(`${endDate}T23:59:59.999`).getTime() : Infinity;
    return entries
      .filter((entry) => tableFilter === 'all' || entry.table === tableFilter)
      .filter((entry) => typeFilter === 'all' || entry.action === typeFilter)
      .filter((entry) => sourceFilter === 'all' || entry.source === sourceFilter)
      .filter((entry) => {
        const timestamp = entry.serverTimestamp ?? entry.timestamp;
        return timestamp >= start && timestamp <= end;
      })
      .filter(
        (entry) =>
          !deferredSearch ||
          entry.id.toLowerCase().includes(deferredSearch) ||
          getEntrySummary(entry).toLowerCase().includes(deferredSearch) ||
          JSON.stringify(entry.after).toLowerCase().includes(deferredSearch)
      )
      .reverse();
  }, [deferredSearch, endDate, entries, sourceFilter, startDate, tableFilter, typeFilter]);

  const sequenceById = useMemo(
    () => new Map(entries.map((entry, index) => [entry.id, index + 1])),
    [entries]
  );
  const blockRows = useMemo(() => {
    const items = filteredEntries.map((entry) => ({
      entry,
      sequence: sequenceById.get(entry.id) ?? 0,
    }));
    return Array.from({ length: Math.ceil(items.length / columnCount) }, (_, index) =>
      items.slice(index * columnCount, (index + 1) * columnCount)
    );
  }, [columnCount, filteredEntries, sequenceById]);
  const counts = useMemo(
    () => ({
      create: filteredEntries.filter((entry) => entry.action === 'create').length,
      update: filteredEntries.filter((entry) => entry.action === 'update').length,
      delete: filteredEntries.filter((entry) => entry.action === 'delete').length,
      restore: filteredEntries.filter((entry) => entry.action === 'restore').length,
      devices: new Set(filteredEntries.map((entry) => entry.clientId).filter(Boolean)).size,
    }),
    [filteredEntries]
  );

  function clearSession() {
    controllerRef.current?.abort();
    setEntries([]);
    setLoadedRows(0);
    setLoading(false);
    setError(undefined);
    toast('本次查阅数据已从页面清除', 'success');
  }

  function applyDateRangePreset(preset: (typeof DATE_RANGE_PRESETS)[number]) {
    setDateRangePreset(preset.id);
    if (preset.days === undefined) {
      setStartDate('');
      setEndDate('');
      return;
    }

    const range = getDateRange(preset.days);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
  }

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-background px-3 py-2.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.close()}
            aria-label="关闭变更审计"
            title="关闭变更审计"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-primary/25 bg-primary/8 text-primary">
            <History className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold">变更审计</h1>
            <p className="truncate text-xs text-muted-foreground">只读内存会话</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void loadHistory()}
            disabled={loading}
            aria-label="重新加载"
            title="重新加载"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="outline" size="sm" onClick={clearSession} className="gap-1.5">
            <X className="h-4 w-4" />
            结束查阅
          </Button>
        </div>
      </header>

      <section className="grid shrink-0 grid-cols-3 border-b border-border bg-card sm:grid-cols-6">
        {[
          ['操作', filteredEntries.length],
          ['新增', counts.create],
          ['更新', counts.update],
          ['删除', counts.delete],
          ['恢复', counts.restore],
          ['设备', counts.devices],
        ].map(([label, value], index) => (
          <div
            key={label}
            className={`px-3 py-2 text-center ${index >= 3 ? 'hidden sm:block' : ''} ${index > 0 ? 'border-l border-border' : ''}`}
          >
            <div className="text-base font-semibold tabular-nums">{value}</div>
            <div className="text-[11px] text-muted-foreground">{label}</div>
          </div>
        ))}
      </section>

      <section className="shrink-0 border-b border-border bg-background">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 sm:px-5">
          <div className="relative min-w-[12rem] flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索内容或操作 ID"
              className="h-9 rounded-md pl-9"
            />
          </div>
          <select
            value={tableFilter}
            onChange={(event) => setTableFilter(event.target.value as AuditTable | 'all')}
            aria-label="业务模块"
            className="h-9 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="all">全部模块</option>
            {AUDIT_TABLES.map((table) => (
              <option key={table} value={table}>
                {TABLE_LABELS[table]}
              </option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as AuditAction | 'all')}
            aria-label="操作类型"
            className="h-9 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="all">全部操作</option>
            <option value="create">新增</option>
            <option value="update">更新</option>
            <option value="delete">删除</option>
            <option value="restore">恢复</option>
          </select>
          <select
            value={sourceFilter}
            onChange={(event) => setSourceFilter(event.target.value as AuditSource | 'all')}
            aria-label="操作来源"
            className="h-9 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="all">全部设备</option>
            <option value="local">本机</option>
            <option value="remote">其他设备</option>
          </select>
        </div>
        <div className="border-t border-border/60 px-3 pb-2 sm:px-5">
          <div className="flex w-full min-w-0 flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-card/60 p-1.5 sm:w-auto">
            <span className="inline-flex items-center gap-1 px-1.5 text-xs font-medium text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              日期范围
            </span>
            <div className="flex flex-wrap items-center gap-1">
              {DATE_RANGE_PRESETS.map((preset) => (
                <Button
                  key={preset.id}
                  type="button"
                  size="sm"
                  variant={dateRangePreset === preset.id ? 'secondary' : 'ghost'}
                  onClick={() => applyDateRangePreset(preset)}
                  className="h-7 rounded-md px-2.5 text-xs"
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <div className="flex min-w-[16rem] flex-1 items-center gap-1.5 sm:flex-none">
              <Input
                type="date"
                value={startDate}
                onChange={(event) => {
                  setDateRangePreset('custom');
                  setStartDate(event.target.value);
                }}
                aria-label="开始日期"
                style={{ colorScheme: theme }}
                className="h-8 min-w-0 flex-1 rounded-md bg-background px-2 text-xs sm:w-[9.5rem] sm:flex-none"
              />
              <span className="shrink-0 text-xs text-muted-foreground">至</span>
              <Input
                type="date"
                value={endDate}
                onChange={(event) => {
                  setDateRangePreset('custom');
                  setEndDate(event.target.value);
                }}
                aria-label="结束日期"
                style={{ colorScheme: theme }}
                className="h-8 min-w-0 flex-1 rounded-md bg-background px-2 text-xs sm:w-[9.5rem] sm:flex-none"
              />
            </div>
          </div>
        </div>
      </section>

      <main className="min-h-0 flex-1 overflow-hidden bg-background">
        <section className="relative h-full min-h-0 overflow-hidden bg-background">
          {loading ? (
            <div className="flex h-full min-h-[20rem] flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
              <LoaderCircle className="h-6 w-6 animate-spin text-primary" />
              <span>正在读取加密历史{loadedRows > 0 ? ` · ${loadedRows} 条` : ''}</span>
            </div>
          ) : error ? (
            <div className="flex h-full min-h-[20rem] flex-col items-center justify-center gap-4 px-6 text-center">
              <DatabaseZap className="h-8 w-8 text-destructive" />
              <p className="max-w-lg text-sm text-foreground">{error}</p>
              <Button onClick={() => void loadHistory()} variant="outline">
                重试
              </Button>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="flex h-full min-h-[20rem] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <History className="h-7 w-7" />
              <span>{entries.length === 0 ? '本次会话没有审计记录' : '没有匹配的记录'}</span>
            </div>
          ) : (
            <VirtualList
              items={blockRows}
              estimateSize={BLOCK_ROW_HEIGHT}
              overscan={2}
              containerClassName="h-full py-4"
              renderItem={(items, rowIndex) => (
                <AuditBlockRow
                  items={items}
                  rowIndex={rowIndex}
                  columnCount={columnCount}
                  hasNextRow={rowIndex < blockRows.length - 1}
                />
              )}
            />
          )}
        </section>
      </main>
    </div>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ToastProvider>
        <ErrorBoundary>
          <AuditApp />
        </ErrorBoundary>
      </ToastProvider>
    </React.StrictMode>
  );
}
