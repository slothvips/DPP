import { type HighlightPart, type MatchResult, REGEX_PRESETS } from './regexShared';

interface RegexResultsProps {
  testString: string;
  matches: MatchResult[];
  highlightedText: string | HighlightPart[];
  onApplyPreset: (pattern: string, flag?: 'g' | 'i' | 'm' | 's' | 'u') => void;
}

export function RegexResults({
  testString,
  matches,
  highlightedText,
  onApplyPreset,
}: RegexResultsProps) {
  return (
    <>
      {testString && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">匹配结果</label>
          <div
            className="p-3 rounded-lg border border-input bg-muted/30 font-mono text-sm whitespace-pre-wrap overflow-x-auto"
            data-testid="regex-highlighted"
          >
            {typeof highlightedText === 'string'
              ? highlightedText || <span className="text-muted-foreground italic">无匹配</span>
              : highlightedText.map((part, i) =>
                  part.highlighted ? (
                    <mark key={i} className="bg-warning/20 dark:bg-warning/30 rounded px-0.5">
                      {part.text}
                    </mark>
                  ) : (
                    <span key={i}>{part.text}</span>
                  )
                )}
          </div>
        </div>
      )}

      {matches.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">
              匹配详情（共 {matches.length} 处）
            </label>
          </div>
          <div className="space-y-2">
            {matches.map((match, i) => (
              <div key={i} className="p-3 rounded-lg border border-border bg-card">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">
                    匹配 {i + 1} · 位置 {match.index}
                  </span>
                </div>
                <div className="font-mono text-sm bg-warning/20 dark:bg-warning/30 rounded px-2 py-1 inline-block">
                  {match.match || <span className="text-muted-foreground italic">空匹配</span>}
                </div>
                {match.groups.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="text-xs text-muted-foreground">捕获组：</div>
                    {match.groups.map((group, j) => (
                      <div key={j} className="flex items-center gap-2 text-sm font-mono">
                        <span className="text-muted-foreground">
                          {group.name ? `${group.name}:` : `$${j + 1}:`}
                        </span>
                        <span className="bg-muted rounded px-1">
                          {group.value || (
                            <span className="italic text-muted-foreground">undefined</span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">常用正则</label>
        <div className="flex flex-wrap gap-2">
          {REGEX_PRESETS.map((preset) => (
            <button
              key={preset.pattern}
              onClick={() => onApplyPreset(preset.pattern, preset.flag)}
              className="px-2 py-1 rounded border border-border bg-card hover:bg-accent hover:text-accent-foreground transition-colors text-xs font-mono"
              title={preset.desc}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
