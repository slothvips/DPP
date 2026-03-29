import { AlertCircle, Check, ChevronLeft, Copy } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface MatchGroup {
  name?: string;
  value: string;
  index: number;
}

interface MatchResult {
  match: string;
  index: number;
  groups: MatchGroup[];
}

const PRESET_MAX_EXEC_TIME = 1000; // 正则执行超时限制（毫秒）

function safeIndexOf(str: string, searchValue: string, fromIndex: number): number {
  const result = str.indexOf(searchValue, fromIndex);
  return result >= 0 ? result : -1;
}

export function RegexView({ onBack }: { onBack?: () => void }) {
  const [pattern, setPattern] = useState('');
  const [testString, setTestString] = useState('');
  const [flags, setFlags] = useState({
    g: true,
    i: false,
    m: false,
    s: false,
    u: false,
  });
  const [copied, setCopied] = useState(false);

  const toggleFlag = useCallback((flag: keyof typeof flags) => {
    setFlags((prev) => ({ ...prev, [flag]: !prev[flag] }));
  }, []);

  const { regex, error, matches } = useMemo(() => {
    if (!pattern) {
      return { regex: null, error: null, matches: [] as MatchResult[] };
    }

    try {
      const flagStr = Object.entries(flags)
        .filter(([, v]) => v)
        .map(([k]) => k)
        .join('');
      const re = new RegExp(pattern, flagStr);
      const results: MatchResult[] = [];

      if (flags.g) {
        const seen = new Set<number>();
        const startTime = Date.now();
        let match: RegExpExecArray | null;
        while ((match = re.exec(testString)) !== null) {
          // 超时保护，防止复杂正则导致性能问题
          if (Date.now() - startTime > PRESET_MAX_EXEC_TIME) {
            return {
              regex: null,
              error: '正则表达式执行超时，请简化模式',
              matches: [] as MatchResult[],
            };
          }
          if (seen.has(match.index)) break;
          seen.add(match.index);
          const currentMatch = match;
          results.push({
            match: currentMatch[0],
            index: currentMatch.index,
            groups: currentMatch.groups
              ? Object.entries(currentMatch.groups).map(([name, value]) => ({
                  name,
                  value: value ?? '',
                  index: safeIndexOf(currentMatch[0], value ?? '', 0),
                }))
              : currentMatch.slice(1).map((value) => ({
                  value,
                  index: safeIndexOf(currentMatch[0], value, 0),
                })),
          });
          if (!currentMatch[0].length) re.lastIndex++;
        }
      } else {
        const match = re.exec(testString);
        if (match) {
          const currentMatch = match;
          results.push({
            match: currentMatch[0],
            index: currentMatch.index,
            groups: currentMatch.groups
              ? Object.entries(currentMatch.groups).map(([name, value]) => ({
                  name,
                  value: value ?? '',
                  index: safeIndexOf(currentMatch[0], value ?? '', 0),
                }))
              : currentMatch.slice(1).map((value) => ({
                  value,
                  index: safeIndexOf(currentMatch[0], value, 0),
                })),
          });
        }
      }

      return { regex: re, error: null, matches: results };
    } catch (e) {
      return { regex: null, error: (e as Error).message, matches: [] as MatchResult[] };
    }
  }, [pattern, testString, flags]);

  const highlightedText = useMemo(() => {
    if (!regex || !testString || matches.length === 0) {
      return testString;
    }

    const parts: { text: string; highlighted: boolean }[] = [];
    let lastIndex = 0;

    for (const match of matches) {
      if (match.index > lastIndex) {
        parts.push({ text: testString.slice(lastIndex, match.index), highlighted: false });
      }
      parts.push({ text: match.match, highlighted: true });
      lastIndex = match.index + match.match.length;
    }

    if (lastIndex < testString.length) {
      parts.push({ text: testString.slice(lastIndex), highlighted: false });
    }

    return parts;
  }, [regex, testString, matches]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(matches.map((m) => m.match).join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [matches]);

  return (
    <div className="flex flex-col h-full" data-testid="regex-view">
      {/* 头部 */}
      <div className="flex items-center gap-3 p-4 border-b border-border shrink-0 bg-background">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} title="返回工具箱">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-foreground">正则表达式测试器</h2>
          <p className="text-sm text-muted-foreground">实时匹配测试，高亮显示匹配结果</p>
        </div>
        {matches.length > 0 && (
          <Button variant="outline" size="icon" onClick={handleCopy} title="复制所有匹配">
            {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
          </Button>
        )}
      </div>

      {/* 主体 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 正则表达式输入 */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">正则表达式</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                /
              </span>
              <Input
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
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

        {/* Flags */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">标志</label>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { key: 'g', label: 'g', title: '全局匹配' },
                { key: 'i', label: 'i', title: '不区分大小写' },
                { key: 'm', label: 'm', title: '多行模式' },
                { key: 's', label: 's', title: '点号匹配换行' },
                { key: 'u', label: 'u', title: 'Unicode' },
              ] as const
            ).map(({ key, label, title }) => (
              <button
                key={key}
                onClick={() => toggleFlag(key)}
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

        {/* 测试字符串 */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">测试文本</label>
          <textarea
            value={testString}
            onChange={(e) => setTestString(e.target.value)}
            placeholder="输入要测试的文本"
            className="w-full h-32 p-3 rounded-lg border border-input bg-background font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            data-testid="regex-test-input"
          />
        </div>

        {/* 高亮结果 */}
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

        {/* 匹配列表 */}
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

        {/* 常用正则预设 */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">常用正则</label>
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <button
                key={preset.pattern}
                onClick={() => {
                  setPattern(preset.pattern);
                  if (preset.flag) {
                    setFlags((prev) => ({ ...prev, [preset.flag]: true }));
                  }
                }}
                className="px-2 py-1 rounded border border-border bg-card hover:bg-accent hover:text-accent-foreground transition-colors text-xs font-mono"
                title={preset.desc}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const presets = [
  { label: '手机号', pattern: '1[3-9]\\d{9}', flag: 'g' as const, desc: '中国大陆手机号' },
  { label: '邮箱', pattern: '[\\w.-]+@[\\w.-]+\\.\\w+', flag: 'g' as const, desc: '电子邮箱地址' },
  { label: 'URL', pattern: 'https?://\\S+', flag: 'g' as const, desc: '网页链接' },
  {
    label: 'IP 地址',
    pattern: '\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}',
    flag: 'g' as const,
    desc: 'IPv4 地址',
  },
  {
    label: '日期',
    pattern: '\\d{4}[-/年]\\d{1,2}[-/月]\\d{1,2}[日]?',
    flag: 'g' as const,
    desc: '日期格式（简化版，可能匹配无效日期）',
  },
  {
    label: '时间',
    pattern: '\\d{1,2}:\\d{2}(:\\d{2})?',
    flag: 'g' as const,
    desc: '时间格式 HH:mm:ss',
  },
  {
    label: '身份证',
    pattern: '[1-9]\\d{5}(19|20)\\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\\d|3[01])\\d{3}[\\dXx]',
    flag: undefined,
    desc: '中国大陆身份证号',
  },
  { label: '中文', pattern: '[\\u4e00-\\u9fa5]+', flag: 'g' as const, desc: '中文字符' },
  { label: '数字', pattern: '-?\\d+(\\.\\d+)?', flag: 'g' as const, desc: '整数或小数' },
  {
    label: 'HTML 标签',
    pattern: '<\\w+[^>]*>|</\\w+>',
    flag: 'g' as const,
    desc: 'HTML 标签（简化版）',
  },
  { label: 'Hex 颜色', pattern: '#[0-9a-fA-F]{3,8}', flag: 'g' as const, desc: '十六进制颜色值' },
  {
    label: 'UUID',
    pattern: '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}',
    flag: 'g' as const,
    desc: 'UUID 格式',
  },
  {
    label: '端口号',
    pattern: '(?:[1-9]\\d{0,3}|[1-5]\\d{4}|6[0-4]\\d{3}|65[0-4]\\d{2}|655[0-2]\\d|6553[0-5])',
    flag: 'g' as const,
    desc: '端口号 (1-65535)',
  },
  { label: '邮政编码', pattern: '[1-9]\\d{5}', flag: 'g' as const, desc: '中国大陆邮政编码' },
];
