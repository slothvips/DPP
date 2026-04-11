import { AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { REGEX_FLAGS, type RegexFlagKey, type RegexFlags } from './regexShared';

interface RegexControlsProps {
  pattern: string;
  error: string | null;
  flags: RegexFlags;
  testString: string;
  onPatternChange: (value: string) => void;
  onTestStringChange: (value: string) => void;
  onToggleFlag: (flag: RegexFlagKey) => void;
}

export function RegexControls({
  pattern,
  error,
  flags,
  testString,
  onPatternChange,
  onTestStringChange,
  onToggleFlag,
}: RegexControlsProps) {
  return (
    <>
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">正则表达式</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              /
            </span>
            <Input
              value={pattern}
              onChange={(e) => onPatternChange(e.target.value)}
              placeholder="输入正则表达式"
              className="pl-6 pr-6 font-mono"
              data-testid="regex-input"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              /
            </span>
          </div>
        </div>
        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">标志</label>
        <div className="flex flex-wrap gap-2">
          {REGEX_FLAGS.map(({ key, label, title }) => (
            <button
              key={key}
              onClick={() => onToggleFlag(key)}
              title={title}
              className={`w-8 h-8 rounded border font-mono text-sm transition-colors ${
                flags[key]
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:bg-accent'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">测试文本</label>
        <textarea
          value={testString}
          onChange={(e) => onTestStringChange(e.target.value)}
          placeholder="输入要测试的文本"
          className="w-full h-32 p-3 rounded-lg border border-input bg-background font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          data-testid="regex-test-input"
        />
      </div>
    </>
  );
}
