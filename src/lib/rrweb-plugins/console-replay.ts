/**
 * rrweb 控制台日志回放插件
 * 在回放时展示录制的控制台日志
 */
import type { eventWithTime } from '@rrweb/types';
import {
  CONSOLE_PLUGIN_NAME,
  type ConsoleLog,
  type ConsolePluginEvent,
  type SerializedValue,
} from './index';

export interface ConsoleReplayPluginOptions {
  /** 控制台事件回调 */
  onConsoleEvent?: (log: ConsoleLog, timestamp: number) => void;
}

export interface ReplayConsolePlugin {
  handler: (event: eventWithTime, isSync: boolean, context: { replayer: unknown }) => void;
}

interface PluginEventData {
  plugin: string;
  payload: ConsolePluginEvent;
}

/**
 * 检查事件是否为控制台插件事件
 */
export function isConsolePluginEvent(event: eventWithTime): boolean {
  return (
    event.type === 6 &&
    typeof event.data === 'object' &&
    event.data !== null &&
    'plugin' in event.data &&
    (event.data as { plugin: string }).plugin === CONSOLE_PLUGIN_NAME
  );
}

/**
 * 获取控制台插件事件的 payload
 */
function getConsolePayload(event: eventWithTime): ConsolePluginEvent | null {
  if (!isConsolePluginEvent(event)) return null;
  const data = event.data as PluginEventData;
  return data.payload;
}

/**
 * 从录制事件中提取所有控制台日志
 * 返回的日志包含 eventTimestamp 字段，表示事件在录制中的时间戳
 */
export function extractConsoleLogs(
  events: eventWithTime[]
): (ConsoleLog & { eventTimestamp: number })[] {
  const logs: (ConsoleLog & { eventTimestamp: number })[] = [];

  for (const event of events) {
    const payload = getConsolePayload(event);
    if (payload && payload.type === 'console') {
      logs.push({
        ...payload.data,
        eventTimestamp: event.timestamp,
      });
    }
  }

  return logs;
}

/**
 * 获取控制台日志回放插件
 */
export function getReplayConsolePlugin(
  options: ConsoleReplayPluginOptions = {}
): ReplayConsolePlugin {
  const { onConsoleEvent } = options;

  return {
    handler(event, _isSync, _context) {
      const payload = getConsolePayload(event);
      if (payload && payload.type === 'console' && onConsoleEvent) {
        onConsoleEvent(payload.data, payload.timestamp);
      }
    },
  };
}

/**
 * 获取日志级别对应的颜色类名
 */
export function getLevelColor(level: string): string {
  switch (level) {
    case 'error':
      return 'text-red-600';
    case 'warn':
      return 'text-yellow-600';
    case 'info':
      return 'text-blue-600';
    case 'debug':
      return 'text-purple-600';
    case 'trace':
      return 'text-gray-500';
    default:
      return 'text-foreground';
  }
}

/**
 * 获取日志级别对应的图标
 */
export function getLevelIcon(level: string): string {
  switch (level) {
    case 'error':
      return '✕';
    case 'warn':
      return '⚠';
    case 'info':
      return 'ℹ';
    case 'debug':
      return '🐛';
    case 'trace':
      return '→';
    default:
      return '●';
  }
}

/**
 * 格式化单个序列化值为字符串
 */
function formatSerializedValue(value: SerializedValue): string {
  switch (value.type) {
    case 'string':
      return `"${value.value}"`;
    case 'number':
      return String(value.value);
    case 'boolean':
      return String(value.value);
    case 'null':
      return 'null';
    case 'undefined':
      return 'undefined';
    case 'object':
      return value.preview;
    case 'array':
      return value.preview;
    case 'function':
      return `ƒ ${value.name || 'anonymous'}()`;
    case 'symbol':
      return `Symbol(${value.description})`;
    case 'error':
      return `${value.name}: ${value.message}`;
    case 'circular':
      return '[Circular]';
    case 'dom':
      return `<${value.tagName.toLowerCase()}${value.id ? ` id="${value.id}"` : ''}${value.className ? ` class="${value.className}"` : ''}>`;
    default:
      return '[Unknown]';
  }
}

/**
 * 格式化控制台参数为显示字符串
 */
export function formatConsoleArgs(args: SerializedValue[]): string {
  return args.map(formatSerializedValue).join(' ');
}
