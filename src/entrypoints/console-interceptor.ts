/**
 * 控制台日志拦截脚本 - 注入到页面主世界执行
 * 此脚本会被打包为独立文件，通过 script 标签注入到页面
 */

export default defineUnlistedScript(() => {
  // 控制台事件名称
  const CONSOLE_EVENT_NAME = 'dpp-console-log';

  // 序列化配置
  const MAX_DEPTH = 3;
  const MAX_STRING_LENGTH = 1000;
  const MAX_ARRAY_LENGTH = 100;
  const MAX_OBJECT_KEYS = 50;

  let logIdCounter = 0;

  function generateLogId(): string {
    return `console-${Date.now()}-${++logIdCounter}`;
  }

  // 序列化值类型（与 lib/rrweb-plugins/index.ts 保持一致，因注入主世界无法导入）
  type SerializedValue =
    | { type: 'string'; value: string }
    | { type: 'number'; value: number }
    | { type: 'boolean'; value: boolean }
    | { type: 'null' }
    | { type: 'undefined' }
    | { type: 'object'; preview: string }
    | { type: 'array'; length: number; preview: string }
    | { type: 'function'; name: string }
    | { type: 'symbol'; description: string }
    | { type: 'error'; name: string; message: string; stack?: string }
    | { type: 'circular' }
    | { type: 'dom'; tagName: string; id?: string; className?: string };

  interface ConsoleLogData {
    id: string;
    level: 'log' | 'info' | 'warn' | 'error' | 'debug' | 'trace';
    args: SerializedValue[];
    timestamp: number;
    stack?: string;
  }

  /**
   * 截断字符串
   */
  function truncateString(str: string, maxLength: number = MAX_STRING_LENGTH): string {
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength) + '...';
  }

  /**
   * 序列化单个值
   */
  function serializeValue(
    value: unknown,
    depth: number = 0,
    seen: WeakSet<object> = new WeakSet()
  ): SerializedValue {
    // 处理 null
    if (value === null) {
      return { type: 'null' };
    }

    // 处理 undefined
    if (value === undefined) {
      return { type: 'undefined' };
    }

    // 处理基本类型
    const type = typeof value;

    if (type === 'string') {
      return { type: 'string', value: truncateString(value as string) };
    }

    if (type === 'number') {
      return { type: 'number', value: value as number };
    }

    if (type === 'boolean') {
      return { type: 'boolean', value: value as boolean };
    }

    if (type === 'symbol') {
      return { type: 'symbol', description: (value as symbol).description || '' };
    }

    if (type === 'function') {
      return { type: 'function', name: (value as () => void).name || 'anonymous' };
    }

    // 处理对象类型
    if (type === 'object') {
      const obj = value as object;

      // 检查循环引用
      if (seen.has(obj)) {
        return { type: 'circular' };
      }
      seen.add(obj);

      // 处理 DOM 元素
      if (obj instanceof Element) {
        return {
          type: 'dom',
          tagName: obj.tagName,
          id: obj.id || undefined,
          className: obj.className || undefined,
        };
      }

      // 处理 Error
      if (obj instanceof Error) {
        return {
          type: 'error',
          name: obj.name,
          message: obj.message,
          stack: obj.stack,
        };
      }

      // 深度限制
      if (depth >= MAX_DEPTH) {
        if (Array.isArray(obj)) {
          return { type: 'array', length: obj.length, preview: '[Array]' };
        }
        return { type: 'object', preview: '[Object]' };
      }

      // 处理数组
      if (Array.isArray(obj)) {
        const items = obj.slice(0, MAX_ARRAY_LENGTH).map((item) => {
          const serialized = serializeValue(item, depth + 1, seen);
          return formatValueForPreview(serialized);
        });
        const preview =
          obj.length > MAX_ARRAY_LENGTH
            ? `[${items.join(', ')}, ... +${obj.length - MAX_ARRAY_LENGTH} more]`
            : `[${items.join(', ')}]`;
        return {
          type: 'array',
          length: obj.length,
          preview: truncateString(preview),
        };
      }

      // 处理普通对象
      try {
        const keys = Object.keys(obj).slice(0, MAX_OBJECT_KEYS);
        const entries = keys.map((key) => {
          const val = (obj as Record<string, unknown>)[key];
          const serialized = serializeValue(val, depth + 1, seen);
          return `${key}: ${formatValueForPreview(serialized)}`;
        });
        const hasMore = Object.keys(obj).length > MAX_OBJECT_KEYS;
        const preview = hasMore ? `{${entries.join(', ')}, ...}` : `{${entries.join(', ')}}`;
        return {
          type: 'object',
          preview: truncateString(preview),
        };
      } catch {
        return { type: 'object', preview: '[Object]' };
      }
    }

    return { type: 'object', preview: '[Unknown]' };
  }

  /**
   * 格式化值用于预览
   */
  function formatValueForPreview(value: SerializedValue): string {
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
        return `ƒ ${value.name}()`;
      case 'symbol':
        return `Symbol(${value.description})`;
      case 'error':
        return `${value.name}: ${value.message}`;
      case 'circular':
        return '[Circular]';
      case 'dom':
        return `<${value.tagName.toLowerCase()}>`;
      default:
        return '[Unknown]';
    }
  }

  /**
   * 获取调用栈
   */
  function getStack(): string | undefined {
    const err = new Error();
    const stack = err.stack;
    if (!stack) return undefined;
    // 移除前几行（Error 和 console 拦截器的调用）
    const lines = stack.split('\n').slice(3);
    return lines.join('\n');
  }

  /**
   * 发送控制台事件
   */
  function emitConsoleEvent(data: ConsoleLogData) {
    window.dispatchEvent(
      new CustomEvent(CONSOLE_EVENT_NAME, {
        detail: data,
      })
    );
  }

  // 拦截的方法列表
  const CONSOLE_METHODS = ['log', 'info', 'warn', 'error', 'debug', 'trace'] as const;
  type ConsoleMethod = (typeof CONSOLE_METHODS)[number];

  // 保存原始方法
  const originalMethods: Record<ConsoleMethod, (...args: unknown[]) => void> = {} as Record<
    ConsoleMethod,
    (...args: unknown[]) => void
  >;

  // 拦截所有方法
  for (const method of CONSOLE_METHODS) {
    originalMethods[method] = console[method].bind(console);

    console[method] = function (...args: unknown[]) {
      // 序列化参数
      const serializedArgs = args.map((arg) => serializeValue(arg));

      // 构建日志数据
      const logData: ConsoleLogData = {
        id: generateLogId(),
        level: method,
        args: serializedArgs,
        timestamp: Date.now(),
      };

      // 对于 trace 和 error，添加调用栈
      if (method === 'trace' || method === 'error') {
        logData.stack = getStack();
      }

      // 发送事件
      emitConsoleEvent(logData);

      // 调用原始方法
      return originalMethods[method](...args);
    };
  }
});
