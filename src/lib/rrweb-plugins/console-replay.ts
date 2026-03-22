/**
 * rrweb 控制台日志回放插件
 * 在回放时展示录制的控制台日志
 */
import type { eventWithTime } from '@rrweb/types';
import {
  CONSOLE_PLUGIN_NAME,
  type ClonedValue,
  type ConsoleLog,
  type ConsolePluginEvent,
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
      return 'text-destructive';
    case 'warn':
      return 'text-warning';
    case 'info':
      return 'text-info';
    case 'debug':
      return 'text-console-debug';
    case 'trace':
      return 'text-muted-foreground';
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
 * 格式化深度克隆的值为显示字符串
 * 支持完整的类型信息展示
 */
export function formatClonedValue(value: ClonedValue, indent: number = 0): string {
  const spaces = '  '.repeat(indent);

  // null
  if (value === null) {
    return 'null';
  }

  // 基本类型
  if (typeof value === 'string') {
    return `"${value}"`;
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (typeof value === 'boolean') {
    return String(value);
  }

  // 数组
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }
    if (value.length <= 5 && indent < 2) {
      // 短数组内联显示
      const items = value.map((v) => formatClonedValue(v, indent + 1));
      const inline = `[${items.join(', ')}]`;
      if (inline.length < 80) {
        return inline;
      }
    }
    // 多行显示
    const items = value.map((v) => `${spaces}  ${formatClonedValue(v, indent + 1)}`);
    return `[\n${items.join(',\n')}\n${spaces}]`;
  }

  // 对象
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;

    // 特殊类型标记
    if ('__type__' in obj) {
      const type = obj.__type__ as string;

      switch (type) {
        case 'undefined':
          return 'undefined';

        case 'number':
          return String(obj.value); // NaN, Infinity

        case 'symbol':
          return `Symbol(${obj.description || ''})`;

        case 'function':
          return `ƒ ${obj.name || 'anonymous'}()`;

        case 'bigint':
          return `${obj.value}n`;

        case 'Element':
          return formatElement(obj);

        case 'Error':
          return formatError(obj);

        case 'Date':
          return `Date(${obj.iso})`;

        case 'RegExp':
          return `/${obj.source}/${obj.flags}`;

        case 'Map':
          return formatMap(obj, indent);

        case 'Set':
          return formatSet(obj, indent);

        case 'WeakMap':
          return 'WeakMap { }';

        case 'WeakSet':
          return 'WeakSet { }';

        case 'Promise':
          return 'Promise { <pending> }';

        case 'ArrayBuffer':
          return `ArrayBuffer(${obj.byteLength})`;

        default:
          // TypedArray 等
          if (type.endsWith('Array') && 'length' in obj) {
            return `${type}(${obj.length})`;
          }
          return `[${type}]`;
      }
    }

    // 循环引用
    if ('__circular__' in obj) {
      return `[Circular: ${obj.__circular__}]`;
    }

    // 错误
    if ('__error__' in obj) {
      return `[Error: ${obj.message}]`;
    }

    // getter
    if ('__getter__' in obj) {
      return '[Getter]';
    }

    // 普通对象
    const keys = Object.keys(obj).filter((k) => !k.startsWith('__'));
    if (keys.length === 0) {
      return '{}';
    }

    if (keys.length <= 3 && indent < 2) {
      // 短对象内联显示
      const entries = keys.map((k) => `${k}: ${formatClonedValue(obj[k], indent + 1)}`);
      const inline = `{${entries.join(', ')}}`;
      if (inline.length < 80) {
        return inline;
      }
    }

    // 多行显示
    const entries = keys.map((k) => `${spaces}  ${k}: ${formatClonedValue(obj[k], indent + 1)}`);
    const protoName = obj.__proto_name__ as string | undefined;
    const prefix = protoName ? `${protoName} ` : '';
    return `${prefix}{\n${entries.join(',\n')}\n${spaces}}`;
  }

  return String(value);
}

/**
 * 格式化 Element
 */
function formatElement(obj: Record<string, unknown>): string {
  const tag = ((obj.tagName as string) || 'unknown').toLowerCase();
  const id = obj.id ? `#${obj.id}` : '';
  const className = obj.className
    ? `.${(obj.className as string).split(' ').filter(Boolean).join('.')}`
    : '';
  return `<${tag}${id}${className}>`;
}

/**
 * 格式化 Error
 */
function formatError(obj: Record<string, unknown>): string {
  return `${obj.name}: ${obj.message}`;
}

/**
 * 格式化 Map
 */
function formatMap(obj: Record<string, unknown>, indent: number): string {
  const entries = obj.entries as Array<{ key: unknown; value: unknown }> | undefined;
  if (!entries || entries.length === 0) {
    return `Map(${obj.size}) {}`;
  }

  const spaces = '  '.repeat(indent);
  const items = entries.map(
    (e) =>
      `${spaces}  ${formatClonedValue(e.key, indent + 1)} => ${formatClonedValue(e.value, indent + 1)}`
  );
  return `Map(${obj.size}) {\n${items.join(',\n')}\n${spaces}}`;
}

/**
 * 格式化 Set
 */
function formatSet(obj: Record<string, unknown>, indent: number): string {
  const values = obj.values as unknown[] | undefined;
  if (!values || values.length === 0) {
    return `Set(${obj.size}) {}`;
  }

  const spaces = '  '.repeat(indent);
  const items = values.map((v) => `${spaces}  ${formatClonedValue(v, indent + 1)}`);
  return `Set(${obj.size}) {\n${items.join(',\n')}\n${spaces}}`;
}
