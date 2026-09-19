import { useLiveQuery } from 'dexie-react-hooks';
import { Clipboard, ExternalLink, Loader2, LockKeyhole, Plus, Save, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { db } from '@/db';
import { fetchNews, getAvailableDates, reportHotNewsArticleOpened } from '@/features/hotNews/api';
import { useLinks } from '@/features/links/hooks/useLinks';
import { openLink } from '@/features/links/utils';
import { getTotpCodeAt, useTotpTicker } from '@/features/totp/hooks/useTotpCode';
import { getTotpPinConfig } from '@/features/totp/totpPin';
import { isTotpPinSessionUnlocked } from '@/features/totp/totpPinSession';
import { copyTotpCode, reportTotpCodesRevealed } from '@/features/totp/utils/copyTotpCode';
import { addBlackboard } from '@/lib/db';
import { listRecentActions, recordRecentAction } from '@/lib/db/recentActions';
import { logger } from '@/utils/logger';
import type { TabId } from './sidepanelTypes';

const PREVIEW_CLASS = 'border-t border-border/60 bg-muted/12 px-2.5 py-2.5';

const QUICK_PREVIEW_MODULES: TabId[] = ['blackboard', 'links', 'totp', 'hotNews'];

export function hasModuleQuickPreview(moduleId: TabId): boolean {
  return QUICK_PREVIEW_MODULES.includes(moduleId);
}

export function ModuleQuickPreview({ moduleId }: { moduleId: TabId }) {
  switch (moduleId) {
    case 'blackboard':
      return <BlackboardQuickPreview />;
    case 'links':
      return <LinksQuickPreview />;
    case 'totp':
      return <TotpQuickPreview />;
    case 'hotNews':
      return <HotNewsQuickPreview />;
    default:
      return null;
  }
}

function PreviewHeader({ title, icon }: { title: string; icon: ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
      {icon}
      <span>{title}</span>
    </div>
  );
}

function BlackboardQuickPreview() {
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  async function handleSave() {
    const value = content.trim();
    if (!value || saving) return;
    setSaving(true);
    try {
      await addBlackboard({ content: value, pinned: false });
      setContent('');
      toast('便签已保存', 'success');
    } catch (error) {
      logger.error('Failed to save quick blackboard note:', error);
      toast('便签保存失败', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={PREVIEW_CLASS}>
      <PreviewHeader title="快速记一条" icon={<Plus className="h-3.5 w-3.5 text-primary" />} />
      <Textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') void handleSave();
        }}
        placeholder="输入便签内容..."
        className="min-h-16 resize-none rounded-md bg-background text-xs"
        autoFocus
      />
      <Button
        size="sm"
        className="mt-2 h-7 w-full text-xs"
        onClick={() => void handleSave()}
        disabled={!content.trim() || saving}
      >
        {saving ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Save className="mr-1.5 h-3.5 w-3.5" />
        )}
        保存便签
      </Button>
    </div>
  );
}

function LinksQuickPreview() {
  const { links } = useLinks();
  const [query, setQuery] = useState('');
  const { toast } = useToast();
  const filteredLinks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return [...(links ?? [])]
      .sort((left, right) => right.lastUsedAt - left.lastUsedAt || right.updatedAt - left.updatedAt)
      .filter((link) =>
        normalizedQuery
          ? `${link.name} ${link.url} ${link.note ?? ''}`.toLowerCase().includes(normalizedQuery)
          : true
      )
      .slice(0, 5);
  }, [links, query]);

  async function handleCopy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast('链接已复制', 'success');
    } catch (error) {
      logger.warn('Failed to copy quick link:', error);
      toast('复制失败', 'error');
    }
  }

  async function handleOpen(link: { id: string; url: string; name: string }) {
    try {
      // openLink 内部统一校验 URL、记录访问并埋点 linkOpened
      await openLink(link.url);
      await recordRecentAction({
        type: 'link_visit',
        targetId: link.id,
        label: link.name,
      });
    } catch (error) {
      logger.warn('Failed to open quick link:', error);
    }
  }

  return (
    <div className={PREVIEW_CLASS}>
      <PreviewHeader
        title="搜索并打开链接"
        icon={<Search className="h-3.5 w-3.5 text-primary" />}
      />
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="搜索名称、地址或备注..."
        className="h-7 rounded-md bg-background text-xs"
        autoFocus
      />
      <div className="mt-1.5 grid h-36 content-start gap-0.5 overflow-y-auto">
        {filteredLinks.length > 0 ? (
          filteredLinks.map((link) => (
            <div
              key={link.id}
              className="flex min-w-0 items-center gap-1 rounded-md px-1 py-1 hover:bg-background"
            >
              <a
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate text-xs text-foreground hover:text-primary"
                title={link.url}
                onClick={(event) => {
                  event.preventDefault();
                  void handleOpen(link);
                }}
              >
                {link.name}
              </a>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                title="复制地址"
                aria-label={`复制链接地址：${link.name}`}
                onClick={() => void handleCopy(link.url)}
              >
                <Clipboard className="h-3 w-3" />
              </Button>
            </div>
          ))
        ) : (
          <span className="px-1 py-2 text-xs text-muted-foreground">没有匹配的链接</span>
        )}
      </div>
    </div>
  );
}

function TotpQuickPreview() {
  const queriedAccounts = useLiveQuery(
    () => db.totpAccounts.filter((account) => !account.deletedAt).sortBy('sortOrder'),
    []
  );
  const accounts = useMemo(() => queriedAccounts ?? [], [queriedAccounts]);
  const pinConfig = useLiveQuery(() => getTotpPinConfig(), []);
  const recentActions = useLiveQuery(() => listRecentActions(), []);
  const locked =
    pinConfig === undefined || (pinConfig.enabled === true && !isTotpPinSessionUnlocked());
  const nowMs = useTotpTicker(accounts.length > 0 && !locked);
  const { toast } = useToast();
  // 明文验证码首次渲染时上报一次 codeRevealed，避免父组件重渲染重复计数
  const revealedTrackedRef = useRef(false);
  useEffect(() => {
    if (revealedTrackedRef.current || locked || accounts.length === 0) return;
    revealedTrackedRef.current = true;
    reportTotpCodesRevealed();
  }, [locked, accounts.length]);
  const orderedAccounts = useMemo(() => {
    const recentCopies = new Map(
      (recentActions ?? [])
        .filter((action) => action.type === 'totp_copy')
        .map((action) => [action.targetId, action.lastUsedAt])
    );
    return [...accounts].sort(
      (left, right) =>
        (recentCopies.get(right.id) ?? 0) - (recentCopies.get(left.id) ?? 0) ||
        left.sortOrder - right.sortOrder
    );
  }, [accounts, recentActions]);

  async function handleCopy(account: (typeof accounts)[number]) {
    const { code } = getTotpCodeAt(account, nowMs);
    if (code === '------') {
      toast('无法生成验证码', 'error');
      return;
    }
    try {
      await copyTotpCode(account, nowMs);
      toast('验证码已复制', 'success');
    } catch (error) {
      logger.warn('Failed to copy quick TOTP code:', error);
      toast('验证码复制失败', 'error');
    }
  }

  return (
    <div className={PREVIEW_CLASS}>
      <PreviewHeader
        title="复制验证码"
        icon={<LockKeyhole className="h-3.5 w-3.5 text-primary" />}
      />
      {locked ? (
        <p className="text-xs leading-5 text-muted-foreground">
          验证器已锁定，请先在验证器中解锁。
        </p>
      ) : accounts.length === 0 ? (
        <p className="text-xs text-muted-foreground">还没有验证器账户。</p>
      ) : (
        <div className="grid gap-1">
          {orderedAccounts.slice(0, 4).map((account) => {
            const { displayCode, remaining } = getTotpCodeAt(account, nowMs);
            return (
              <Button
                key={account.id}
                variant="ghost"
                className="h-8 justify-between px-2 font-normal hover:bg-background"
                onClick={() => void handleCopy(account)}
                title="复制验证码"
              >
                <span className="min-w-0 truncate text-xs">{account.label}</span>
                <span className="ml-2 shrink-0 font-mono text-sm tabular-nums">
                  {displayCode} · {remaining}s
                </span>
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function HotNewsQuickPreview() {
  const date = getAvailableDates()[0]?.value;
  const cachedNews = useLiveQuery(() => (date ? db.hotNews.get(date) : undefined), [date]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);
  const { toast } = useToast();
  const news = cachedNews?.data;
  const items = news?.sections.flatMap((section) => section.items).slice(0, 5) ?? [];

  const handleRefresh = useCallback(async () => {
    if (!date || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      await fetchNews(date, { trigger: 'preview' });
      toast('热榜已刷新', 'success');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '热榜刷新失败';
      setError(message);
      logger.warn('Failed to refresh quick hot news:', cause);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [date, toast]);

  useEffect(() => {
    if (!date || cachedNews) return;
    void handleRefresh();
  }, [cachedNews, date, handleRefresh]);

  return (
    <div className={PREVIEW_CLASS}>
      <PreviewHeader
        title="打开今日热榜"
        icon={<ExternalLink className="h-3.5 w-3.5 text-primary" />}
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {items.length > 0 ? (
        <div className="grid gap-1">
          {items.map((item, index) => (
            <a
              key={item.url}
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="flex min-w-0 items-start gap-1.5 rounded-md px-1 py-1 text-xs text-foreground hover:bg-background hover:text-primary"
              onClick={() => reportHotNewsArticleOpened('quickPreview')}
            >
              <span className="shrink-0 text-muted-foreground">{index + 1}.</span>
              <span className="line-clamp-2 min-w-0">{item.title}</span>
            </a>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {loading ? '正在加载今日热榜...' : '今天暂无热榜内容。'}
        </p>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="mt-1 h-7 px-1.5 text-xs"
        onClick={() => void handleRefresh()}
        disabled={loading}
      >
        {loading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
        刷新
      </Button>
    </div>
  );
}
