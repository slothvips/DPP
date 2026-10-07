import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import type { NotifyTargetKind } from '@/db';
import { saveNotifyConfig, sendSavedNotifyTest } from '@/features/notify/saveConfig';
import { DEFAULT_NOTIFY_TEMPLATE, notifyTemplateSource } from '@/features/notify/template';
import { getNotifyConfig, listActiveNotifyTargets } from '@/lib/db/notify';
import { cn } from '@/utils/cn';
import { logger } from '@/utils/logger';

interface DraftTarget {
  id: string;
  kind: NotifyTargetKind;
  label: string;
  chatId: string;
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
          }))
        );
      } catch (error) {
        logger.error('[Notify] 读取消息配置失败', error);
        if (mounted) toastRef.current('读取消息配置失败', 'error');
      } finally {
        if (mounted) setLoaded(true);
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
      await saveNotifyConfig({ botToken, messageTemplate, targets });
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

            <div className="space-y-3" data-testid="notify-target-list">
              {targets.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-foreground">
                  还没有接收对象
                </div>
              ) : (
                targets.map((target) => (
                  <div
                    key={target.id}
                    className="grid gap-3 rounded-lg border border-border bg-background p-3 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)_auto] sm:items-end"
                  >
                    <label className="block min-w-0 space-y-1.5">
                      <span className="text-sm font-medium text-foreground">名称</span>
                      <Input
                        aria-label="名称"
                        data-testid="notify-target-label"
                        placeholder="可空"
                        value={target.label}
                        disabled={busy}
                        onChange={(event) => updateTarget(target.id, { label: event.target.value })}
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
                        onChange={(event) =>
                          updateTarget(target.id, { chatId: event.target.value })
                        }
                      />
                    </label>
                    <div className="flex items-end gap-2">
                      <div className="space-y-1.5">
                        <span className="block text-sm font-medium text-foreground">类型</span>
                        <div
                          className="flex h-10 rounded-xl bg-muted p-1"
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
                                onClick={() => updateTarget(target.id, { kind: kind.value })}
                              >
                                {kind.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-destructive hover:text-destructive"
                        data-testid="notify-target-remove"
                        aria-label="移除"
                        disabled={busy}
                        onClick={() =>
                          setTargets((current) => current.filter((item) => item.id !== target.id))
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              用户要先给机器人发过一句话，群里要先把机器人加进去。chat_id 是数字，群一般以 -100
              开头。
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
                  { id: crypto.randomUUID(), kind: 'user', label: '', chatId: '' },
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
