import { Check, Copy, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { TimestampDateDetails } from './timestampShared';

interface TimestampResultProps {
  aiCorrectedInput: string | null;
  aiReasoning: string | null;
  copied: string | null;
  currentInput: string;
  dateDetails: TimestampDateDetails;
  onCopy: (text: string, key: string) => void;
}

function CopyButton({
  copied,
  copyKey,
  onCopy,
  text,
}: {
  copied: string | null;
  copyKey: string;
  onCopy: (text: string, key: string) => void;
  text: string;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6 shrink-0"
      onClick={() => onCopy(text, copyKey)}
    >
      {copied === copyKey ? (
        <Check className="h-3 w-3 text-success" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </Button>
  );
}

export function TimestampResult({
  aiCorrectedInput,
  aiReasoning,
  copied,
  currentInput,
  dateDetails,
  onCopy,
}: TimestampResultProps) {
  return (
    <div className="space-y-4">
      {aiCorrectedInput && (
        <div className="flex items-start gap-2 p-3 rounded-lg border border-primary/50 bg-primary/5 text-xs">
          <Sparkles className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="text-foreground">
              AI 修正:{' '}
              <span className="line-through text-muted-foreground">{aiCorrectedInput}</span> →{' '}
              <span className="font-mono font-medium">{currentInput}</span>
            </div>
            {aiReasoning && <div className="text-muted-foreground">{aiReasoning}</div>}
          </div>
        </div>
      )}

      <div className="p-3 rounded-lg border border-border bg-card space-y-3">
        <div className="text-xs font-medium text-foreground">时间戳</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-muted-foreground mb-1">毫秒 (ms)</div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm">{dateDetails.ts}</span>
              <CopyButton
                copied={copied}
                copyKey="ms"
                onCopy={onCopy}
                text={String(dateDetails.ts)}
              />
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">秒 (s)</div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm">{dateDetails.tsSeconds}</span>
              <CopyButton
                copied={copied}
                copyKey="s"
                onCopy={onCopy}
                text={String(dateDetails.tsSeconds)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="p-3 rounded-lg border border-border bg-card space-y-3">
        <div className="text-xs font-medium text-foreground">标准格式</div>
        <div className="space-y-2">
          <div>
            <div className="text-xs text-muted-foreground mb-1">ISO 8601</div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs break-all">{dateDetails.isoString}</span>
              <CopyButton
                copied={copied}
                copyKey="iso"
                onCopy={onCopy}
                text={dateDetails.isoString}
              />
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">RFC 2822</div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs break-all">{dateDetails.utcStr}</span>
              <CopyButton copied={copied} copyKey="rfc" onCopy={onCopy} text={dateDetails.utcStr} />
            </div>
          </div>
        </div>
      </div>

      <div className="p-3 rounded-lg border border-border bg-card space-y-3">
        <div className="text-xs font-medium text-foreground">日期分解</div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="p-2 rounded bg-muted/50">
            <div className="text-muted-foreground">年</div>
            <div className="font-mono font-medium">{dateDetails.year}</div>
          </div>
          <div className="p-2 rounded bg-muted/50">
            <div className="text-muted-foreground">月</div>
            <div className="font-mono font-medium">
              {dateDetails.padded.month} ({dateDetails.monthName})
            </div>
          </div>
          <div className="p-2 rounded bg-muted/50">
            <div className="text-muted-foreground">日</div>
            <div className="font-mono font-medium">
              {dateDetails.padded.day} ({dateDetails.dayOfWeek})
            </div>
          </div>
          <div className="p-2 rounded bg-muted/50">
            <div className="text-muted-foreground">时</div>
            <div className="font-mono font-medium">{dateDetails.padded.hours}</div>
          </div>
          <div className="p-2 rounded bg-muted/50">
            <div className="text-muted-foreground">分</div>
            <div className="font-mono font-medium">{dateDetails.padded.minutes}</div>
          </div>
          <div className="p-2 rounded bg-muted/50">
            <div className="text-muted-foreground">秒</div>
            <div className="font-mono font-medium">{dateDetails.padded.seconds}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 rounded bg-muted/50">
            <div className="text-muted-foreground">年中第 {dateDetails.dayOfYear} 天</div>
          </div>
          <div className="p-2 rounded bg-muted/50">
            <div className="text-muted-foreground">年第 {dateDetails.weekNum} 周</div>
          </div>
        </div>
      </div>

      <div className="p-3 rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground">相对于现在</div>
            <div className="font-mono font-medium">{dateDetails.relative}</div>
          </div>
          <CopyButton copied={copied} copyKey="rel" onCopy={onCopy} text={dateDetails.relative} />
        </div>
      </div>
    </div>
  );
}
