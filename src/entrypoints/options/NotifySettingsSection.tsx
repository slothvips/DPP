import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import type { JenkinsEnvironment, NotifySubscriptions, NotifyTargetKind } from '@/db';
import { isJenkinsFolderClass } from '@/features/jenkins/api/client';
import { canonicalHttpUrl } from '@/features/notify/canonical';
import { saveNotifyConfig, sendSavedNotifyTest } from '@/features/notify/saveConfig';
import { DEFAULT_NOTIFY_TEMPLATE, notifyTemplateSource } from '@/features/notify/template';
import { getAllScopedJenkinsJobs } from '@/lib/db/jenkinsQueries';
import { getNotifyConfig, listActiveNotifyTargets } from '@/lib/db/notify';
import { getSetting } from '@/lib/db/settings';
import { cn } from '@/utils/cn';
import { logger } from '@/utils/logger';

interface JenkinsDraft {
  enabled: boolean;
  allJobs: boolean;
  jobs: string[];
}

interface DraftTarget {
  id: string;
  kind: NotifyTargetKind;
  label: string;
  chatId: string;
  jenkins: JenkinsDraft;
}

interface NotifyJobChoice {
  envName: string;
  url: string;
  name: string;
}

function allJenkinsJobs(): JenkinsDraft {
  return { enabled: true, allJobs: true, jobs: [] };
}

function jenkinsDraft(subscriptions: NotifySubscriptions | undefined): JenkinsDraft {
  const jenkins = subscriptions?.jenkins;
  if (!jenkins) return allJenkinsJobs();
  return {
    enabled: jenkins.enabled,
    allJobs: jenkins.jobs === undefined,
    jobs: [...(jenkins.jobs ?? [])],
  };
}

function toSubscriptions(jenkins: JenkinsDraft): NotifySubscriptions {
  const jobs = jenkins.allJobs ? undefined : jenkins.jobs;
  return { jenkins: { enabled: jenkins.enabled, ...(jobs === undefined ? {} : { jobs }) } };
}

const KINDS = [
  { value: 'user', label: '用户' },
  { value: 'group', label: '群' },
] as const satisfies ReadonlyArray<{ value: NotifyTargetKind; label: string }>;

export function NotifySettingsSection() {
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [botToken, setBotToken] = useState('');
  const [messageTemplate, setMessageTemplate] = useState(DEFAULT_NOTIFY_TEMPLATE);
  const [targets, setTargets] = useState<DraftTarget[]>([]);
  const [jobChoices, setJobChoices] = useState<NotifyJobChoice[]>([]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const [config, rows] = await Promise.all([getNotifyConfig(), listActiveNotifyTargets()]);
        if (!mounted) return;
        setBotToken(config?.botToken ?? '');
        setMessageTemplate(notifyTemplateSource(config?.messageTemplate ?? ''));
        setTargets(
          rows.map((row) => ({
            id: row.id,
            kind: row.kind,
            label: row.label,
            chatId: row.chatId,
            jenkins: jenkinsDraft(row.subscriptions),
          }))
        );
      } catch (error) {
        logger.error('[Notify] 读取消息配置失败', error);
        if (mounted) toastRef.current('读取消息配置失败', 'error');
      } finally {
        if (mounted) setLoaded(true);
      }

      if (!mounted) return;
      try {
        const [jobs, environments] = await Promise.all([
          getAllScopedJenkinsJobs(),
          getSetting('jenkins_environments'),
        ]);
        if (!mounted) return;
        setJobChoices(notifyJobChoices(jobs, environments ?? []));
      } catch (error) {
        logger.error('[Notify] 读取 Jenkins 任务失败', error);
        if (mounted) toastRef.current('Jenkins 任务列表读取失败，指定 Job 暂不可用', 'error');
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const updateTarget = (id: string, patch: Partial<DraftTarget>) => {
    setTargets((current) =>
      current.map((target) => (target.id === id ? { ...target, ...patch } : target))
    );
  };

  const handleTest = async () => {
    if (saving || testing) return;
    setTesting(true);
    try {
      const count = await sendSavedNotifyTest({ botToken, messageTemplate, targets });
      toast(`已发给 ${count} 个已保存的接收对象`, 'success');
    } catch (error) {
      logger.error('[Notify] 试发消息失败', error);
      toast(error instanceof Error ? error.message : '试发失败', 'error');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (saving || testing) return;
    setSaving(true);
    try {
      await saveNotifyConfig({
        botToken,
        messageTemplate,
        targets: targets.map((target) => ({
          id: target.id,
          kind: target.kind,
          label: target.label,
          chatId: target.chatId,
          subscriptions: toSubscriptions(target.jenkins),
        })),
      });
      toast('消息配置已保存', 'success');
    } catch (error) {
      logger.error('[Notify] 保存消息配置失败', error);
      toast(error instanceof Error ? error.message : '保存失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  const ready = botToken.trim() !== '' && targets.length > 0;
  const busy = saving || testing;

  return (
    <section className="min-w-0 space-y-4 rounded-lg border bg-card p-4 text-foreground">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">消息</h2>
        <p className="text-sm text-muted-foreground">
          这里只配置通道。试发发出下面的正文。各功能模块自己保存通知模板。
        </p>
      </div>

      {!loaded ? (
        <p className="text-sm text-muted-foreground">读取中</p>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">机器人 Token</span>
              <button
                type="button"
                className="text-sm font-medium text-foreground"
                onClick={() => setShowToken((current) => !current)}
              >
                {showToken ? '隐藏' : '显示'}
              </button>
            </div>
            <Input
              id="notify-bot-token"
              data-testid="notify-bot-token"
              type={showToken ? 'text' : 'password'}
              autoComplete="off"
              placeholder="123456:ABC-DEF..."
              value={botToken}
              disabled={busy}
              onChange={(event) => setBotToken(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              在 Telegram 找 @BotFather 创建机器人，把 Token 贴到这里。
            </p>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium">消息内容</span>
            <Textarea
              data-testid="notify-message-template"
              value={messageTemplate}
              disabled={busy}
              rows={3}
              onChange={(event) => setMessageTemplate(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {'试发时原样发出这段文字。清空后保存会回到默认试发句。'}
            </p>
          </div>

          <div className="space-y-3 border-t border-border pt-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">接收对象</span>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
                {ready ? `会通知 ${targets.length} 个` : '还没配齐，暂时不会发送'}
              </span>
            </div>

            <div className="space-y-2" data-testid="notify-target-list">
              {targets.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-foreground">
                  还没有接收对象
                </div>
              ) : (
                targets.map((target, index) => (
                  <NotifyTargetCard
                    key={target.id}
                    target={target}
                    index={index}
                    jobs={jobChoices}
                    busy={busy}
                    onChange={(patch) => updateTarget(target.id, patch)}
                    onRemove={() =>
                      setTargets((current) => current.filter((item) => item.id !== target.id))
                    }
                  />
                ))
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              每个对象单独订阅。用户要先给机器人发过一句话，群的 chat_id 一般以 -100 开头。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              data-testid="notify-target-add"
              disabled={busy}
              onClick={() =>
                setTargets((current) => [
                  ...current,
                  {
                    id: crypto.randomUUID(),
                    kind: 'user',
                    label: '',
                    chatId: '',
                    jenkins: allJenkinsJobs(),
                  },
                ])
              }
            >
              <Plus className="mr-1.5 h-4 w-4" />
              添加接收对象
            </Button>
            <div className="ml-auto flex gap-2">
              <Button
                type="button"
                variant="outline"
                data-testid="notify-test"
                disabled={busy}
                onClick={() => void handleTest()}
              >
                {testing ? '发送中...' : '试发一条'}
              </Button>
              <Button
                type="button"
                data-testid="notify-save"
                disabled={busy}
                onClick={() => void handleSave()}
              >
                {saving ? '保存中...' : '保存'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function notifyJobChoices(
  jobs: Awaited<ReturnType<typeof getAllScopedJenkinsJobs>>,
  environments: JenkinsEnvironment[]
): NotifyJobChoice[] {
  const names = new Map(environments.map((env) => [env.id, env.name.trim() || env.host]));
  const seen = new Set<string>();
  const choices: NotifyJobChoice[] = [];
  for (const job of jobs) {
    if (isJenkinsFolderClass(job.type)) continue;
    const url = canonicalHttpUrl(job.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    choices.push({
      envName: names.get(job.envId) || job.envId,
      url,
      name: job.fullName?.trim() || job.name.trim() || url,
    });
  }
  choices.sort(
    (left, right) =>
      left.envName.localeCompare(right.envName) || left.name.localeCompare(right.name)
  );
  return choices;
}

function targetTitle(target: { label: string; chatId: string }, index: number): string {
  return target.label.trim() || target.chatId.trim() || `接收对象 ${index + 1}`;
}

function NotifyTargetCard({
  target,
  index,
  jobs,
  busy,
  onChange,
  onRemove,
}: {
  target: DraftTarget;
  index: number;
  jobs: NotifyJobChoice[];
  busy: boolean;
  onChange: (patch: Partial<DraftTarget>) => void;
  onRemove: () => void;
}) {
  const title = targetTitle(target, index);
  const [editing, setEditing] = useState(target.chatId.trim() === '');
  const kindLabel = KINDS.find((kind) => kind.value === target.kind)?.label ?? '用户';
  const chat = target.chatId.trim();
  const detail = [
    kindLabel,
    chat && chat !== title ? chat : '',
    subscriptionSummary(target.jenkins),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">「{title}」</p>
          <p className="truncate text-sm text-foreground">{detail}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <JenkinsSubscriptionFields
            title={title}
            jenkins={target.jenkins}
            jobs={jobs}
            busy={busy}
            onChange={(jenkins) => onChange({ jenkins })}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => setEditing((current) => !current)}
          >
            {editing ? '收起' : '编辑'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 text-destructive hover:text-destructive"
            data-testid="notify-target-remove"
            aria-label="移除"
            disabled={busy}
            onClick={onRemove}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {editing ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)_auto] sm:items-end">
          <label className="block min-w-0 space-y-1.5">
            <span className="text-sm font-medium text-foreground">名称</span>
            <Input
              aria-label="名称"
              data-testid="notify-target-label"
              placeholder="可空"
              value={target.label}
              disabled={busy}
              onChange={(event) => onChange({ label: event.target.value })}
            />
          </label>
          <label className="block min-w-0 space-y-1.5">
            <span className="text-sm font-medium text-foreground">chat_id</span>
            <Input
              aria-label="chat_id"
              data-testid="notify-target-chat-id"
              placeholder="-1001234567890"
              value={target.chatId}
              disabled={busy}
              onChange={(event) => onChange({ chatId: event.target.value })}
            />
          </label>
          <div className="space-y-1.5">
            <span className="block text-sm font-medium text-foreground">类型</span>
            <div
              className="flex h-10 w-fit rounded-xl bg-muted p-1"
              data-testid="notify-target-kind"
              role="group"
              aria-label="用户或群"
            >
              {KINDS.map((kind) => {
                const selected = target.kind === kind.value;
                return (
                  <button
                    key={kind.value}
                    type="button"
                    disabled={busy}
                    aria-pressed={selected}
                    className={cn(
                      'rounded-lg px-3 text-sm !text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
                      selected
                        ? '!bg-background font-medium shadow-sm ring-1 ring-border'
                        : '!bg-transparent'
                    )}
                    onClick={() => onChange({ kind: kind.value })}
                  >
                    {kind.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function subscriptionSummary(jenkins: JenkinsDraft): string {
  if (!jenkins.enabled) return '不接收 Jenkins';
  if (jenkins.allJobs) return 'Jenkins · 全部 Job';
  if (jenkins.jobs.length === 0) return 'Jenkins · 未选 Job';
  return `Jenkins · ${jenkins.jobs.length} 个 Job`;
}

function JenkinsSubscriptionFields({
  title,
  jenkins,
  jobs,
  busy,
  onChange,
}: {
  title: string;
  jenkins: JenkinsDraft;
  jobs: NotifyJobChoice[];
  busy: boolean;
  onChange: (jenkins: JenkinsDraft) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const known = new Set(jobs.map((job) => job.url));
  const extra = jenkins.jobs.filter((url) => !known.has(url));
  const needle = query.trim().toLowerCase();
  // 搜索同样作用于不在缓存里的已订 URL，便于找到并取消勾选。
  const extraVisible = needle ? extra.filter((url) => url.toLowerCase().includes(needle)) : extra;
  const visible = needle
    ? jobs.filter(
        (job) =>
          job.name.toLowerCase().includes(needle) || job.envName.toLowerCase().includes(needle)
      )
    : jobs;
  const groups = new Map<string, NotifyJobChoice[]>();
  for (const job of visible) {
    const list = groups.get(job.envName) ?? [];
    list.push(job);
    groups.set(job.envName, list);
  }

  const toggleJob = (url: string) => {
    const selected = jenkins.jobs.includes(url);
    onChange({
      ...jenkins,
      allJobs: false,
      jobs: selected ? jenkins.jobs.filter((item) => item !== url) : [...jenkins.jobs, url],
    });
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        data-testid="notify-target-subscribe"
        aria-label={`设置「${title}」的订阅`}
        disabled={busy}
        onClick={() => setOpen(true)}
      >
        订阅
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>订阅 · {title}</DialogTitle>
            <DialogDescription>只写入「{title}」。其他接收对象保持各自的订阅。</DialogDescription>
          </DialogHeader>
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Checkbox
              data-testid="notify-target-jenkins"
              checked={jenkins.enabled}
              disabled={busy}
              onCheckedChange={(checked) => onChange({ ...jenkins, enabled: checked === true })}
            />
            Jenkins 构建
          </label>
          {jenkins.enabled ? (
            <div className="space-y-3">
              <div
                className="flex h-9 w-fit rounded-xl bg-muted p-1"
                data-testid="notify-target-jobs-mode"
                role="group"
                aria-label="Job 范围"
              >
                {(
                  [
                    { allJobs: true, label: '全部 Job' },
                    { allJobs: false, label: '指定 Job' },
                  ] as const
                ).map((mode) => {
                  const selected = jenkins.allJobs === mode.allJobs;
                  return (
                    <button
                      key={mode.label}
                      type="button"
                      disabled={busy}
                      aria-pressed={selected}
                      className={cn(
                        'rounded-lg px-3 text-sm !text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
                        selected
                          ? '!bg-background font-medium shadow-sm ring-1 ring-border'
                          : '!bg-transparent'
                      )}
                      onClick={() => onChange({ ...jenkins, allJobs: mode.allJobs })}
                    >
                      {mode.label}
                    </button>
                  );
                })}
              </div>
              {jenkins.allJobs ? (
                <p className="text-sm text-foreground">
                  「{title}」会收到所有 Jenkins 任务的构建通知。
                </p>
              ) : (
                <div className="space-y-2">
                  <Input
                    value={query}
                    disabled={busy}
                    placeholder="搜索任务"
                    onChange={(event) => setQuery(event.target.value)}
                  />
                  <div className="max-h-64 space-y-3 overflow-y-auto rounded-lg border border-border p-2">
                    {jobs.length === 0 && extra.length === 0 ? (
                      <p className="text-sm text-foreground">
                        还没有 Jenkins 任务。先在 Jenkins 页打开一次，或改回全部 Job。
                      </p>
                    ) : visible.length === 0 && extraVisible.length === 0 ? (
                      <p className="text-sm text-foreground">没有匹配的任务。</p>
                    ) : null}
                    {[...groups].map(([envName, list]) => (
                      <div key={envName} className="space-y-1">
                        <p className="text-xs font-medium text-foreground">{envName}</p>
                        {list.map((job) => (
                          <label
                            key={job.url}
                            className="flex items-center gap-2 text-sm text-foreground"
                          >
                            <Checkbox
                              data-testid="notify-target-job"
                              checked={jenkins.jobs.includes(job.url)}
                              disabled={busy}
                              onCheckedChange={() => toggleJob(job.url)}
                            />
                            <span className="min-w-0 truncate">{job.name}</span>
                          </label>
                        ))}
                      </div>
                    ))}
                    {extraVisible.length > 0 ? (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-foreground">不在当前任务列表里</p>
                        {extraVisible.map((url) => (
                          <label
                            key={url}
                            className="flex items-center gap-2 text-sm text-foreground"
                          >
                            <Checkbox
                              data-testid="notify-target-job"
                              checked
                              disabled={busy}
                              onCheckedChange={() => toggleJob(url)}
                            />
                            <span className="min-w-0 truncate">{url}</span>
                          </label>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-foreground">
              关闭后，「{title}」不会收到 Jenkins 构建通知。
            </p>
          )}
          <DialogFooter>
            <Button type="button" disabled={busy} onClick={() => setOpen(false)}>
              完成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
