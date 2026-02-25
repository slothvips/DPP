import { useMemo, useState } from 'react';
import {
  type ClonedValue,
  type ConsoleLog,
  extractConsoleLogs,
  formatClonedValue,
  getLevelColor,
  getLevelIcon,
} from '@/lib/rrweb-plugins';
import { cn } from '@/utils/cn';
import type { eventWithTime } from '@rrweb/types';

type ConsoleLogWithTimestamp = ConsoleLog & { eventTimestamp: number };

interface ConsolePanelProps {
  events: eventWithTime[];
  currentTime?: number;
}

type LogStatus = 'past' | 'active' | 'future';

const LOG_LEVELS = ['log', 'info', 'warn', 'error', 'debug', 'trace'] as const;
type LogLevel = (typeof LOG_LEVELS)[number];

export function ConsolePanel({ events, currentTime }: ConsolePanelProps) {
  const [filter, setFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState<Set<LogLevel>>(new Set());

  const logs = extractConsoleLogs(events);

  // 找到第一个有效的时间戳作为录制开始时间
  const recordingStartTime = useMemo(() => {
    for (const event of events) {
      if (event.timestamp && event.timestamp > 0) {
        return event.timestamp;
      }
    }
    return 0;
  }, [events]);

  // 按事件时间戳排序日志
  const sortedLogs = useMemo(() => {
    return [...logs].sort((a, b) => a.eventTimestamp - b.eventTimestamp);
  }, [logs]);

  // 过滤日志
  const filteredLogs = sortedLogs.filter((log) => {
    // 级别过滤
    if (levelFilter.size > 0 && !levelFilter.has(log.level)) {
      return false;
    }
    // 文本过滤
    if (!filter) return true;
    const lowerFilter = filter.toLowerCase();
    const content = log.args
      .map((arg) => formatClonedValue(arg))
      .join(' ')
      .toLowerCase();
    return content.includes(lowerFilter) || log.level.includes(lowerFilter);
  });

  // 获取日志相对于录制开始的时间（毫秒）
  const getRelativeTime = (eventTimestamp: number) => {
    return eventTimestamp - recordingStartTime;
  };

  // 判断日志状态：past（已发生）、active（当前）、future（未发生）
  const getLogStatus = (log: ConsoleLogWithTimestamp): LogStatus => {
    if (currentTime === undefined) return 'past';
    const relativeTime = getRelativeTime(log.eventTimestamp);
    // 日志显示窗口 500ms
    const window = 500;

    if (currentTime < relativeTime) return 'future';
    if (currentTime >= relativeTime && currentTime <= relativeTime + window) return 'active';
    return 'past';
  };

  // 格式化时间点显示
  const formatTimePoint = (eventTimestamp: number) => {
    const relativeMs = getRelativeTime(eventTimestamp);
    if (relativeMs < 0) return '00:00.000';
    const totalSeconds = Math.floor(relativeMs / 1000);
    const ms = Math.floor(relativeMs % 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  // 统计各状态日志数量
  const statusCounts = useMemo(() => {
    const counts = { past: 0, active: 0, future: 0 };
    filteredLogs.forEach((log) => {
      counts[getLogStatus(log)]++;
    });
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredLogs, currentTime]);

  // 统计各级别日志数量
  const levelCounts = useMemo(() => {
    const counts: Record<LogLevel, number> = {
      log: 0,
      info: 0,
      warn: 0,
      error: 0,
      debug: 0,
      trace: 0,
    };
    sortedLogs.forEach((log) => {
      counts[log.level]++;
    });
    return counts;
  }, [sortedLogs]);

  // 切换级别过滤
  const toggleLevelFilter = (level: LogLevel) => {
    setLevelFilter((prev) => {
      const next = new Set(prev);
      if (next.has(level)) {
        next.delete(level);
      } else {
        next.add(level);
      }
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full bg-background text-foreground text-sm">
      {/* 工具栏 */}
      <div className="flex flex-col gap-2 p-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="过滤日志..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="flex-1 px-2 py-1 text-sm border rounded bg-background"
          />
          <div className="flex items-center gap-2 text-xs">
            <span className="text-green-600">{statusCounts.past}</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-blue-600">{statusCounts.active}</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-muted-foreground/50">{statusCounts.future}</span>
          </div>
        </div>

        {/* 级别过滤按钮 */}
        <div className="flex items-center gap-1 flex-wrap">
          {LOG_LEVELS.map((level) => (
            <button
              key={level}
              onClick={() => toggleLevelFilter(level)}
              className={cn(
                'px-2 py-0.5 text-xs rounded transition-colors flex items-center gap-1',
                levelFilter.size === 0 || levelFilter.has(level)
                  ? getLevelButtonStyle(level)
                  : 'bg-muted/50 text-muted-foreground/50'
              )}
            >
              <span>{getLevelIcon(level)}</span>
              <span>{level}</span>
              {levelCounts[level] > 0 && (
                <span className="ml-0.5 opacity-70">({levelCounts[level]})</span>
              )}
            </button>
          ))}
          {levelFilter.size > 0 && (
            <button
              onClick={() => setLevelFilter(new Set())}
              className="px-2 py-0.5 text-xs rounded bg-muted text-muted-foreground hover:bg-muted/80"
            >
              清除
            </button>
          )}
        </div>
      </div>

      {/* 日志列表 */}
      <div className="flex-1 overflow-auto">
        {filteredLogs.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            {logs.length === 0 ? '没有录制到控制台日志' : '没有匹配的日志'}
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {filteredLogs.map((log) => (
              <ConsoleLogItem
                key={log.id}
                log={log}
                status={getLogStatus(log)}
                timeLabel={formatTimePoint(log.eventTimestamp)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface ConsoleLogItemProps {
  log: ConsoleLogWithTimestamp;
  status: LogStatus;
  timeLabel: string;
}

function ConsoleLogItem({ log, status, timeLabel }: ConsoleLogItemProps) {
  const [showStack, setShowStack] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const isFuture = status === 'future';
  const isActive = status === 'active';
  const hasStack = log.stack && (log.level === 'error' || log.level === 'trace');

  // 格式化参数显示
  const formattedContent = useMemo(() => {
    return log.args.map((arg) => formatClonedValue(arg)).join(' ');
  }, [log.args]);

  // 判断是否需要展开按钮（内容较长或包含换行）
  const needsExpand = formattedContent.length > 200 || formattedContent.includes('\n');

  return (
    <div
      className={cn(
        'px-2 py-1.5 transition-colors',
        isActive && 'bg-blue-500/20 border-l-2 border-l-blue-500',
        isFuture && 'opacity-40',
        !isFuture && !isActive && getLogBackground(log.level)
      )}
    >
      <div className="flex items-start gap-2">
        {/* 级别图标 */}
        <span
          className={cn(
            'flex-shrink-0 w-4 text-center',
            isFuture ? 'text-muted-foreground/50' : getLevelColor(log.level)
          )}
          title={log.level}
        >
          {getLevelIcon(log.level)}
        </span>

        {/* 时间 */}
        <span
          className={cn(
            'flex-shrink-0 font-mono text-xs',
            isFuture ? 'text-muted-foreground/50' : 'text-muted-foreground'
          )}
        >
          {timeLabel}
        </span>

        {/* 内容 */}
        <div className="flex-1 min-w-0">
          <div
            className={cn(
              'font-mono text-xs break-all',
              isFuture && 'text-muted-foreground/50',
              !expanded && needsExpand && 'line-clamp-3'
            )}
          >
            <FormattedArgs args={log.args} isFuture={isFuture} expanded={expanded} />
          </div>

          {/* 展开/收起按钮 */}
          {needsExpand && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-blue-500 hover:text-blue-600 mt-1"
            >
              {expanded ? '收起' : '展开全部'}
            </button>
          )}

          {/* 调用栈 */}
          {hasStack && (
            <div className="mt-1">
              <button
                onClick={() => setShowStack(!showStack)}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <svg
                  className={cn('w-3 h-3 transition-transform', showStack && 'rotate-90')}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
                <span>调用栈</span>
              </button>
              {showStack && (
                <pre className="mt-1 p-2 text-xs font-mono bg-muted/50 rounded overflow-x-auto text-muted-foreground">
                  {log.stack}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface FormattedArgsProps {
  args: ClonedValue[];
  isFuture?: boolean;
  expanded?: boolean;
}

function FormattedArgs({ args, isFuture, expanded }: FormattedArgsProps) {
  return (
    <>
      {args.map((arg, index) => (
        <span key={index}>
          {index > 0 && ' '}
          <FormattedValue value={arg} isFuture={isFuture} expanded={expanded} />
        </span>
      ))}
    </>
  );
}

interface FormattedValueProps {
  value: ClonedValue;
  isFuture?: boolean;
  expanded?: boolean;
}

function FormattedValue({ value, isFuture, expanded }: FormattedValueProps) {
  const baseClass = isFuture ? 'text-muted-foreground/50' : '';

  // null
  if (value === null) {
    return <span className={cn(baseClass, !isFuture && 'text-gray-500 italic')}>null</span>;
  }

  // 基本类型
  if (typeof value === 'string') {
    return <span className={cn(baseClass, !isFuture && 'text-green-600')}>"{value}"</span>;
  }

  if (typeof value === 'number') {
    return <span className={cn(baseClass, !isFuture && 'text-blue-600')}>{value}</span>;
  }

  if (typeof value === 'boolean') {
    return <span className={cn(baseClass, !isFuture && 'text-purple-600')}>{String(value)}</span>;
  }

  // 数组
  if (Array.isArray(value)) {
    if (expanded) {
      return (
        <span className={baseClass}>
          <span className="text-muted-foreground">[</span>
          {value.map((item, i) => (
            <span key={i}>
              {i > 0 && <span className="text-muted-foreground">, </span>}
              <FormattedValue value={item} isFuture={isFuture} expanded={expanded} />
            </span>
          ))}
          <span className="text-muted-foreground">]</span>
        </span>
      );
    }
    return (
      <span className={cn(baseClass, !isFuture && 'text-foreground')}>Array({value.length})</span>
    );
  }

  // 对象
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;

    // 特殊类型
    if ('__type__' in obj) {
      const type = obj.__type__ as string;

      switch (type) {
        case 'undefined':
          return (
            <span className={cn(baseClass, !isFuture && 'text-gray-500 italic')}>undefined</span>
          );

        case 'number':
          return (
            <span className={cn(baseClass, !isFuture && 'text-blue-600')}>{String(obj.value)}</span>
          );

        case 'symbol':
          return (
            <span className={cn(baseClass, !isFuture && 'text-yellow-600')}>
              Symbol({(obj.description as string) || ''})
            </span>
          );

        case 'function':
          return (
            <span className={cn(baseClass, !isFuture && 'text-cyan-600')}>
              ƒ {(obj.name as string) || 'anonymous'}()
            </span>
          );

        case 'bigint':
          return (
            <span className={cn(baseClass, !isFuture && 'text-blue-600')}>
              {String(obj.value)}n
            </span>
          );

        case 'Element':
          return (
            <span className={cn(baseClass, !isFuture && 'text-purple-600')}>
              &lt;{((obj.tagName as string) || 'unknown').toLowerCase()}
              {obj.id ? `#${String(obj.id)}` : ''}
              {obj.className
                ? `.${(obj.className as string).split(' ').filter(Boolean).join('.')}`
                : ''}
              &gt;
            </span>
          );

        case 'Error':
          return (
            <span className={cn(baseClass, !isFuture && 'text-red-600')}>
              {String(obj.name)}: {String(obj.message)}
            </span>
          );

        case 'Date':
          return (
            <span className={cn(baseClass, !isFuture && 'text-foreground')}>
              Date({String(obj.iso)})
            </span>
          );

        case 'RegExp':
          return (
            <span className={cn(baseClass, !isFuture && 'text-red-500')}>
              /{String(obj.source)}/{String(obj.flags)}
            </span>
          );

        case 'Map':
          return (
            <span className={cn(baseClass, !isFuture && 'text-foreground')}>
              Map({String(obj.size)})
            </span>
          );

        case 'Set':
          return (
            <span className={cn(baseClass, !isFuture && 'text-foreground')}>
              Set({String(obj.size)})
            </span>
          );

        case 'WeakMap':
          return (
            <span className={cn(baseClass, !isFuture && 'text-foreground')}>WeakMap {'{}'}</span>
          );

        case 'WeakSet':
          return (
            <span className={cn(baseClass, !isFuture && 'text-foreground')}>WeakSet {'{}'}</span>
          );

        case 'Promise':
          return (
            <span className={cn(baseClass, !isFuture && 'text-foreground')}>
              Promise {'{ <pending> }'}
            </span>
          );

        case 'ArrayBuffer':
          return (
            <span className={cn(baseClass, !isFuture && 'text-foreground')}>
              ArrayBuffer({String(obj.byteLength)})
            </span>
          );

        default:
          if (type.endsWith('Array') && 'length' in obj) {
            return (
              <span className={cn(baseClass, !isFuture && 'text-foreground')}>
                {type}({String(obj.length)})
              </span>
            );
          }
          return <span className={cn(baseClass, !isFuture && 'text-foreground')}>[{type}]</span>;
      }
    }

    // 循环引用
    if ('__circular__' in obj) {
      return (
        <span className={cn(baseClass, !isFuture && 'text-orange-600')}>
          [Circular: {String(obj.__circular__)}]
        </span>
      );
    }

    // 错误
    if ('__error__' in obj) {
      return (
        <span className={cn(baseClass, !isFuture && 'text-red-600')}>
          [Error: {String(obj.message)}]
        </span>
      );
    }

    // getter
    if ('__getter__' in obj) {
      return <span className={cn(baseClass, !isFuture && 'text-gray-500')}>[Getter]</span>;
    }

    // 普通对象
    const keys = Object.keys(obj).filter((k) => !k.startsWith('__'));
    if (expanded) {
      return (
        <span className={baseClass}>
          <span className="text-muted-foreground">{'{'}</span>
          {keys.map((key, i) => (
            <span key={key}>
              {i > 0 && <span className="text-muted-foreground">, </span>}
              <span className="text-purple-500">{key}</span>
              <span className="text-muted-foreground">: </span>
              <FormattedValue value={obj[key]} isFuture={isFuture} expanded={expanded} />
            </span>
          ))}
          <span className="text-muted-foreground">{'}'}</span>
        </span>
      );
    }

    const protoName = obj.__proto_name__ as string | undefined;
    return (
      <span className={cn(baseClass, !isFuture && 'text-foreground')}>
        {protoName ? `${protoName} ` : ''}
        {'{'}...{'}'}
      </span>
    );
  }

  return <span className={baseClass}>{String(value)}</span>;
}

/**
 * 获取级别按钮样式
 */
function getLevelButtonStyle(level: LogLevel): string {
  switch (level) {
    case 'error':
      return 'bg-red-500/20 text-red-600 hover:bg-red-500/30';
    case 'warn':
      return 'bg-yellow-500/20 text-yellow-600 hover:bg-yellow-500/30';
    case 'info':
      return 'bg-blue-500/20 text-blue-600 hover:bg-blue-500/30';
    case 'debug':
      return 'bg-purple-500/20 text-purple-600 hover:bg-purple-500/30';
    case 'trace':
      return 'bg-gray-500/20 text-gray-600 hover:bg-gray-500/30';
    default:
      return 'bg-muted text-foreground hover:bg-muted/80';
  }
}

/**
 * 获取日志背景色
 */
function getLogBackground(level: LogLevel): string {
  switch (level) {
    case 'error':
      return 'bg-red-500/5';
    case 'warn':
      return 'bg-yellow-500/5';
    default:
      return '';
  }
}
