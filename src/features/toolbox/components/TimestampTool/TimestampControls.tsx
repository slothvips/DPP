import { Loader2, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TIMEZONES } from './timestampShared';

interface TimestampControlsProps {
  inputValue: string;
  isAiFixing: boolean;
  isInvalid: boolean;
  onAiFix: () => void;
  onInputChange: (value: string) => void;
  onTimezoneChange: (value: string) => void;
  timezone: string;
}

export function TimestampControls({
  inputValue,
  isAiFixing,
  isInvalid,
  onAiFix,
  onInputChange,
  onTimezoneChange,
  timezone,
}: TimestampControlsProps) {
  return (
    <>
      <div className="space-y-2">
        <Label className="text-foreground">时区</Label>
        <select
          value={timezone}
          onChange={(event) => onTimezoneChange(event.target.value)}
          className="w-full p-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label className="text-foreground">请输入日期</Label>
        <div className="relative">
          <Input
            value={inputValue}
            onChange={(event) => onInputChange(event.target.value)}
            placeholder="输入时间戳、日期或自然语言"
            className="font-mono pr-24"
            data-testid="timestamp-input"
          />
          {isInvalid && !isAiFixing && <ButtonLikeAiFix onClick={onAiFix} />}
          {isAiFixing && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              AI 分析中...
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function ButtonLikeAiFix({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 px-2 inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary"
      title="AI 智能修正"
    >
      <Sparkles className="h-3.5 w-3.5" />
      AI 修正
    </button>
  );
}
