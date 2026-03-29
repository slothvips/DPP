import { Check, ChevronLeft, Copy, Loader2, Sparkles } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { correctTimestampWithAI } from './aiFixer';

const TIMEZONES = [
  { label: '本地时间', value: 'local' },
  { label: 'UTC', value: 'UTC' },
  { label: '北京时间 (UTC+8)', value: 'Asia/Shanghai' },
  { label: '东京时间 (UTC+9)', value: 'Asia/Tokyo' },
  { label: '洛杉矶 (UTC-8)', value: 'America/Los_Angeles' },
  { label: '纽约 (UTC-5)', value: 'America/New_York' },
];

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const MONTHS = [
  '一月',
  '二月',
  '三月',
  '四月',
  '五月',
  '六月',
  '七月',
  '八月',
  '九月',
  '十月',
  '十一月',
  '十二月',
];

function formatRelativeTime(date: Date, now: Date): string {
  const diff = now.getTime() - date.getTime();
  const absDiff = Math.abs(diff);
  const isPast = diff > 0;

  const seconds = Math.floor(absDiff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) return `${years} 年${isPast ? '前' : '后'}`;
  if (months > 0) return `${months} 月${isPast ? '前' : '后'}`;
  if (weeks > 0) return `${weeks} 周${isPast ? '前' : '后'}`;
  if (days > 0) return `${days} 天${isPast ? '前' : '后'}`;
  if (hours > 0) return `${hours} 小时${isPast ? '前' : '后'}`;
  if (minutes > 0) return `${minutes} 分钟${isPast ? '前' : '后'}`;
  return `${seconds} 秒${isPast ? '前' : '后'}`;
}

// JavaScript Date 的有效时间戳范围
const MIN_TIMESTAMP = -8640000000000000;
const MAX_TIMESTAMP = 8640000000000000;

export function TimestampView({ onBack }: { onBack?: () => void }) {
  const [timestampInput, setTimestampInput] = useState('');
  const [timezone, setTimezone] = useState('local');
  const [copied, setCopied] = useState<string | null>(null);
  const [isAiFixing, setIsAiFixing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiCorrectedInput, setAiCorrectedInput] = useState<string | null>(null);
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);

  const parseToDate = useCallback((input: string): Date | null => {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // 尝试作为时间戳解析（毫秒或秒）
    const num = Number(trimmed);
    if (!isNaN(num)) {
      // 使用数值大小判断秒/毫秒：
      // - 秒时间戳通常 < 1e12（约 2001-09-09 之前）
      // - 毫秒时间戳通常 >= 1e12
      // 同时处理负数时间戳（1970 年之前）
      const absNum = Math.abs(num);
      let msTimestamp: number;

      if (absNum < 1e12) {
        // 可能是秒时间戳
        msTimestamp = num * 1000;
      } else {
        // 毫秒时间戳
        msTimestamp = num;
      }

      // 边界检查：确保时间戳在 JavaScript Date 的有效范围内
      if (msTimestamp < MIN_TIMESTAMP || msTimestamp > MAX_TIMESTAMP) {
        return null;
      }

      return new Date(msTimestamp);
    }

    // 尝试作为日期字符串解析
    const parsed = new Date(input);
    if (!isNaN(parsed.getTime())) {
      // 同样检查解析后的时间戳是否在有效范围内
      const ts = parsed.getTime();
      if (ts < MIN_TIMESTAMP || ts > MAX_TIMESTAMP) {
        return null;
      }
      return parsed;
    }

    return null;
  }, []);

  const handleAiFix = useCallback(async () => {
    if (!timestampInput.trim()) return;

    const originalInput = timestampInput;
    setIsAiFixing(true);
    setAiError(null);
    setAiCorrectedInput(null);
    setAiReasoning(null);

    try {
      // 使用当前时间作为基准（而非组件渲染时的时间）
      const result = await correctTimestampWithAI(timestampInput, new Date(), timezone);
      if (result.success && result.correctedInput) {
        setAiCorrectedInput(originalInput);
        setAiReasoning(result.reasoning || null);
        setTimestampInput(result.correctedInput);
      } else {
        setAiError(result.error || '无法修正输入');
        setAiReasoning(result.reasoning || null);
      }
    } catch {
      setAiError('AI 调用失败');
    } finally {
      setIsAiFixing(false);
    }
  }, [timestampInput, timezone]);

  const dateFromTimestamp = parseToDate(timestampInput);
  const isInvalid = timestampInput.trim() && !dateFromTimestamp;

  const copyToClipboard = useCallback((text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  // 格式化日期详情
  const dateDetails = useMemo(() => {
    if (!dateFromTimestamp) return null;

    const ts = dateFromTimestamp.getTime();
    const tsSeconds = Math.floor(ts / 1000);

    // 获取指定时区的日期组件
    // 使用 Intl.DateTimeFormat 精确获取时区日期，避免 toLocaleString 的精度损失
    const getTzDateParts = (date: Date, tz: string) => {
      if (tz === 'local') {
        return {
          year: date.getFullYear(),
          month: date.getMonth() + 1,
          day: date.getDate(),
          hours: date.getHours(),
          minutes: date.getMinutes(),
          seconds: date.getSeconds(),
          dayOfWeek: date.getDay(),
        };
      }

      // 使用 Intl.DateTimeFormat 获取指定时区的日期组件
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false,
        weekday: 'short',
      });

      const parts = formatter.formatToParts(date);
      const getPart = (type: Intl.DateTimeFormatPartTypes) => {
        const part = parts.find((p) => p.type === type);
        return part ? part.value : '';
      };

      const weekdayMap: Record<string, number> = {
        Sun: 0,
        Mon: 1,
        Tue: 2,
        Wed: 3,
        Thu: 4,
        Fri: 5,
        Sat: 6,
      };

      return {
        year: parseInt(getPart('year'), 10),
        month: parseInt(getPart('month'), 10),
        day: parseInt(getPart('day'), 10),
        hours: parseInt(getPart('hour'), 10),
        minutes: parseInt(getPart('minute'), 10),
        seconds: parseInt(getPart('second'), 10),
        dayOfWeek: weekdayMap[getPart('weekday')] ?? 0,
      };
    };

    const tzDateParts = getTzDateParts(dateFromTimestamp, timezone);
    const { year, month, day, hours, minutes, seconds, dayOfWeek } = tzDateParts;

    // ISO 周数计算（ISO 8601 标准）
    // 规则：第1周是包含该年第一个周四的那一周
    const getISOWeek = (date: Date): number => {
      const d = new Date(date.getTime());
      // 设置到周四（ISO 周定义）
      d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
      // 获取该年的开始
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      // 计算周数
      return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    };

    const weekNum = getISOWeek(dateFromTimestamp);

    // 年中天数（使用 UTC 避免夏令时问题）
    const utcYear = dateFromTimestamp.getUTCFullYear();
    const dayOfYear =
      Math.floor((dateFromTimestamp.getTime() - Date.UTC(utcYear, 0, 1)) / 86400000) + 1;

    // ISO 8601 格式 (总是 UTC)
    const isoString = dateFromTimestamp.toISOString();

    // Local 时间格式化
    const localStr = dateFromTimestamp.toLocaleString('zh-CN');

    // UTC 时间格式化
    const utcStr = dateFromTimestamp.toUTCString();

    return {
      ts,
      tsSeconds,
      year,
      month,
      day,
      hours,
      minutes,
      seconds,
      dayOfWeek: WEEKDAYS[dayOfWeek],
      dayOfYear,
      weekNum,
      monthName: MONTHS[month - 1],
      isoString,
      localStr,
      utcStr,
      relative: formatRelativeTime(dateFromTimestamp, new Date()),
      padded: {
        month: String(month).padStart(2, '0'),
        day: String(day).padStart(2, '0'),
        hours: String(hours).padStart(2, '0'),
        minutes: String(minutes).padStart(2, '0'),
        seconds: String(seconds).padStart(2, '0'),
      },
    };
  }, [dateFromTimestamp, timezone]);

  return (
    <div className="flex flex-col h-full" data-testid="timestamp-view">
      {/* 头部 */}
      <div className="flex items-center gap-3 p-4 border-b border-border shrink-0 bg-background">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} title="返回工具箱">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-foreground">时间戳转换器</h2>
          <p className="text-sm text-muted-foreground">时间戳与日期时间互转，支持多时区</p>
        </div>
      </div>

      {/* 主体 */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {/* 时区选择 */}
        <div className="space-y-2">
          <Label className="text-foreground">时区</Label>
          <select
            value={timezone}
            onChange={(e) => {
              setTimezone(e.target.value);
              setAiError(null);
              setAiReasoning(null);
              setAiCorrectedInput(null);
            }}
            className="w-full p-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </div>

        {/* 输入 */}
        <div className="space-y-2">
          <Label className="text-foreground">请输入日期</Label>
          <div className="relative">
            <Input
              value={timestampInput}
              onChange={(e) => {
                setTimestampInput(e.target.value);
                setAiError(null);
                setAiReasoning(null);
                setAiCorrectedInput(null);
              }}
              placeholder="输入时间戳、日期或自然语言"
              className="font-mono pr-24"
              data-testid="timestamp-input"
            />
            {isInvalid && !isAiFixing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleAiFix}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 gap-1.5 text-xs text-primary hover:text-primary"
                title="AI 智能修正"
              >
                <Sparkles className="h-3.5 w-3.5" />
                AI 修正
              </Button>
            )}
            {isAiFixing && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                AI 分析中...
              </div>
            )}
          </div>
        </div>

        {/* 结果展示 */}
        {timestampInput && dateDetails && (
          <div className="space-y-4">
            {/* AI 修正信息 */}
            {aiCorrectedInput && (
              <div className="flex items-start gap-2 p-3 rounded-lg border border-primary/50 bg-primary/5 text-xs">
                <Sparkles className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="text-foreground">
                    AI 修正: <span className="line-through opacity-60">{aiCorrectedInput}</span> →
                    <span className="font-mono font-medium">{timestampInput}</span>
                  </div>
                  {aiReasoning && (
                    <div className="text-muted-foreground opacity-70">{aiReasoning}</div>
                  )}
                </div>
              </div>
            )}

            {/* 时间戳 */}
            <div className="p-3 rounded-lg border border-border bg-card space-y-3">
              <div className="text-xs font-medium text-foreground">时间戳</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">毫秒 (ms)</div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm">{dateDetails.ts}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => copyToClipboard(String(dateDetails.ts), 'ms')}
                    >
                      {copied === 'ms' ? (
                        <Check className="h-3 w-3 text-success" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">秒 (s)</div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm">{dateDetails.tsSeconds}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => copyToClipboard(String(dateDetails.tsSeconds), 's')}
                    >
                      {copied === 's' ? (
                        <Check className="h-3 w-3 text-success" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* 标准格式 */}
            <div className="p-3 rounded-lg border border-border bg-card space-y-3">
              <div className="text-xs font-medium text-foreground">标准格式</div>
              <div className="space-y-2">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">ISO 8601</div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs break-all">{dateDetails.isoString}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => copyToClipboard(dateDetails.isoString, 'iso')}
                    >
                      {copied === 'iso' ? (
                        <Check className="h-3 w-3 text-success" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">RFC 2822</div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs break-all">{dateDetails.utcStr}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => copyToClipboard(dateDetails.utcStr, 'rfc')}
                    >
                      {copied === 'rfc' ? (
                        <Check className="h-3 w-3 text-success" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* 日期分解 */}
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

            {/* 相对时间 */}
            <div className="p-3 rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">相对于现在</div>
                  <div className="font-mono font-medium">{dateDetails.relative}</div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => copyToClipboard(dateDetails.relative, 'rel')}
                >
                  {copied === 'rel' ? (
                    <Check className="h-3 w-3 text-success" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* AI 错误 */}
        {isInvalid && aiError && (
          <div className="p-3 rounded-lg border border-destructive/50 bg-destructive/5 space-y-1">
            <div className="text-sm text-destructive">{aiError}</div>
            {aiReasoning && (
              <div className="text-xs text-muted-foreground italic">{aiReasoning}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
