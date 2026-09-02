import { Check, GripVertical, Pencil, Trash2 } from 'lucide-react';
import { type DragEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { recordRecentAction } from '@/lib/db';
import { cn } from '@/utils/cn';
import { logger } from '@/utils/logger';
import { getTotpCodeAt } from '../hooks/useTotpCode';
import type { TotpAccountItem } from '../types';

interface TotpAccountListItemProps {
  account: TotpAccountItem;
  nowMs: number;
  showCode?: boolean;
  isDragging?: boolean;
  dragEnabled?: boolean;
  onEdit: (account: TotpAccountItem) => void;
  onDelete: (account: TotpAccountItem) => void;
  onDragStart?: (accountId: string) => void;
  onDragOver?: (event: DragEvent, accountId: string) => void;
  onDragEnd?: () => void;
}

function maskedCode(digits: number): string {
  if (digits === 8) return '•••• ••••';
  return '••• •••';
}

export function TotpAccountListItem({
  account,
  nowMs,
  showCode = false,
  isDragging = false,
  dragEnabled = true,
  onEdit,
  onDelete,
  onDragStart,
  onDragOver,
  onDragEnd,
}: TotpAccountListItemProps) {
  const [copied, setCopied] = useState(false);
  const { code, displayCode, remaining } = getTotpCodeAt(account, nowMs);
  const progress = remaining / account.period;
  const isUrgent = remaining <= 5;
  const detail = [account.issuer, account.account].filter(Boolean).join(' · ');

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      await recordRecentAction({
        type: 'totp_copy',
        targetId: account.id,
        label: account.label,
      });
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      logger.warn('Clipboard API not available');
    }
  }

  const codeText = copied ? '已复制' : showCode ? displayCode : maskedCode(account.digits);

  return (
    <div
      className={cn(
        // 与链接模块一致：用 background 表面，避免深色下 card-on-card 发灰发糊
        'group relative overflow-hidden rounded-2xl border border-border/60 bg-background/90 shadow-sm transition-all',
        'hover:border-primary/20 hover:bg-muted/16 hover:shadow-md',
        copied && 'border-success/45 bg-success/12',
        isUrgent && !copied && 'border-destructive/40',
        isDragging && 'opacity-45'
      )}
      data-testid={`totp-account-${account.id}`}
      onDragOver={
        dragEnabled && onDragOver
          ? (event) => {
              event.preventDefault();
              onDragOver(event, account.id);
            }
          : undefined
      }
    >
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-muted">
        <div
          className={cn(
            'h-full transition-[width] duration-200 ease-linear',
            isUrgent ? 'bg-destructive' : 'bg-primary'
          )}
          style={{ width: `${Math.max(0, Math.min(100, progress * 100))}%` }}
        />
      </div>

      <div className="flex items-start gap-1 px-2 pt-2">
        {dragEnabled ? (
          <button
            type="button"
            draggable
            className="mt-0.5 flex h-6 w-6 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
            title="拖动排序"
            aria-label="拖动排序"
            data-testid={`totp-drag-${account.id}`}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = 'move';
              onDragStart?.(account.id);
            }}
            onDragEnd={() => onDragEnd?.()}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        ) : null}

        <div className="min-w-0 flex-1 pt-0.5">
          <div className="truncate text-xs font-semibold tracking-wide text-foreground">
            {account.label}
          </div>
          {detail ? (
            <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{detail}</div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={() => onEdit(account)}
            title="编辑"
            data-testid={`totp-edit-${account.id}`}
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(account)}
            title="删除"
            data-testid={`totp-delete-${account.id}`}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => void handleCopy()}
        className="relative flex w-full flex-col items-center px-3 pb-3.5 pt-1.5"
        title="点击复制验证码"
        data-testid={`totp-code-${account.id}`}
      >
        <div
          className={cn(
            'max-w-full break-all font-mono text-2xl font-bold leading-none tracking-[0.12em] tabular-nums',
            copied ? 'text-success' : isUrgent ? 'text-destructive' : 'text-foreground'
          )}
        >
          {codeText}
        </div>
        <div className="mt-2 flex h-4 items-center gap-1.5 text-xs tabular-nums text-muted-foreground">
          {copied ? (
            <>
              <Check className="h-3 w-3 text-success" />
              <span className="text-success">已复制到剪贴板</span>
            </>
          ) : (
            <span>{remaining}s · 点击复制</span>
          )}
        </div>
      </button>
    </div>
  );
}
