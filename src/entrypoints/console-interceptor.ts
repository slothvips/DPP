/**
 * 控制台日志拦截脚本 - 注入到页面主世界执行
 * 此脚本会被打包为独立文件，通过 script 标签注入到页面
 *
 * 设计原则：
 * 1. 对主世界完全无感知 - 任何异常都不能影响原始 console 行为
 * 2. 不产生副作用 - 序列化过程不触发 getter、不修改对象
 * 3. 性能优先 - 快速序列化，避免阻塞主线程
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
   * 安全地获取对象属性，不触发 getter 副作用
   */
  function safeGetOwnPropertyNames(obj: object): string[] {
    try {
      return Object.getOwnPropertyNames(obj).slice(0, MAX_OBJECT_KEYS);
    } catch {
      return [];
    }
  }

  /**
   * 安全地获取属性值
   */
  function safeGetProperty(obj: object, key: string): unknown {
    try {
      // 使用 Object.getOwnPropertyDescriptor 检查是否有 getter
      const descriptor = Object.getOwnPropertyDescriptor(obj, key);
      if (descriptor && typeof descriptor.get === 'function') {
        // 有 getter，返回占位符避免触发副作用
        return '[Getter]';
      }
      return (obj as Record<string, unknown>)[key];
    } catch {
      return '[Error accessing property]';
    }
  }

  /**
   * 序列化单个值 - 完全安全，不会抛出异常
   */
  function serializeValue(
    value: unknown,
    depth: number = 0,
    seen: WeakSet<object> = new WeakSet()
  ): SerializedValue {
    try {
      return serializeValueUnsafe(value, depth, seen);
    } catch {
      // 任何异常都返回安全的占位符
      return { type: 'object', preview: '[Serialization Error]' };
    }
  }

  /**
   * 序列化单个值的内部实现
   */
  function serializeValueUnsafe(
    value: unknown,
    depth: number,
    seen: WeakSet<object>
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
      const num = value as number;
      // 处理特殊数字值
      if (Number.isNaN(num)) {
        return { type: 'number', value: 'NaN' as unknown as number };
      }
      if (!Number.isFinite(num)) {
        return { type: 'number', value: (num > 0 ? 'Infinity' : '-Infinity') as unknown as number };
      }
      return { type: 'number', value: num };
    }

    if (type === 'boolean') {
      return { type: 'boolean', value: value as boolean };
    }

    if (type === 'symbol') {
      try {
        return { type: 'symbol', description: (value as symbol).description || '' };
      } catch {
        return { type: 'symbol', description: '' };
      }
    }

    if (type === 'function') {
      try {
        return { type: 'function', name: (value as () => void).name || 'anonymous' };
      } catch {
        return { type: 'function', name: 'anonymous' };
      }
    }

    // 处理 BigInt
    if (type === 'bigint') {
      return { type: 'string', value: `${value}n` };
    }

    // 处理对象类型
    if (type === 'object') {
      const obj = value as object;

      // 检查循环引用
      if (seen.has(obj)) {
        return { type: 'circular' };
      }

      // 先添加到 seen，防止循环引用
      seen.add(obj);

      // 处理 DOM 元素
      try {
        if (obj instanceof Element) {
          return {
            type: 'dom',
            tagName: obj.tagName || 'UNKNOWN',
            id: obj.id || undefined,
            className: (typeof obj.className === 'string' ? obj.className : '') || undefined,
          };
        }
      } catch {
        return { type: 'dom', tagName: 'UNKNOWN' };
      }

      // 处理 Error
      try {
        if (obj instanceof Error) {
          return {
            type: 'error',
            name: obj.name || 'Error',
            message: obj.message || '',
            stack: obj.stack,
          };
        }
      } catch {
        return { type: 'error', name: 'Error', message: '[Unable to read error]' };
      }

      // 处理 Promise
      try {
        if (obj instanceof Promise) {
          return { type: 'object', preview: 'Promise { <pending> }' };
        }
      } catch {
        // ignore
      }

      // 处理 WeakMap/WeakSet
      try {
        if (obj instanceof WeakMap) {
          return { type: 'object', preview: 'WeakMap { }' };
        }
        if (obj instanceof WeakSet) {
          return { type: 'object', preview: 'WeakSet { }' };
        }
      } catch {
        // ignore
      }

      // 处理 Map
      try {
        if (obj instanceof Map) {
          if (depth >= MAX_DEPTH) {
            return { type: 'object', preview: `Map(${obj.size})` };
          }
          const entries: string[] = [];
          let count = 0;
          for (const [k, v] of obj) {
            if (count >= MAX_OBJECT_KEYS) break;
            const keyStr = formatValueForPreview(serializeValue(k, depth + 1, seen));
            const valStr = formatValueForPreview(serializeValue(v, depth + 1, seen));
            entries.push(`${keyStr} => ${valStr}`);
            count++;
          }
          const hasMore = obj.size > MAX_OBJECT_KEYS;
          return {
            type: 'object',
            preview: truncateString(
              `Map(${obj.size}) {${entries.join(', ')}${hasMore ? ', ...' : ''}}`
            ),
          };
        }
      } catch {
        return { type: 'object', preview: 'Map { }' };
      }

      // 处理 Set
      try {
        if (obj instanceof Set) {
          if (depth >= MAX_DEPTH) {
            return { type: 'object', preview: `Set(${obj.size})` };
          }
          const items: string[] = [];
          let count = 0;
          for (const v of obj) {
            if (count >= MAX_ARRAY_LENGTH) break;
            items.push(formatValueForPreview(serializeValue(v, depth + 1, seen)));
            count++;
          }
          const hasMore = obj.size > MAX_ARRAY_LENGTH;
          return {
            type: 'object',
            preview: truncateString(
              `Set(${obj.size}) {${items.join(', ')}${hasMore ? ', ...' : ''}}`
            ),
          };
        }
      } catch {
        return { type: 'object', preview: 'Set { }' };
      }

      // 处理 Date
      try {
        if (obj instanceof Date) {
          return { type: 'object', preview: obj.toISOString() };
        }
      } catch {
        return { type: 'object', preview: 'Invalid Date' };
      }

      // 处理 RegExp
      try {
        if (obj instanceof RegExp) {
          return { type: 'object', preview: obj.toString() };
        }
      } catch {
        return { type: 'object', preview: '/.../' };
      }

      // 深度限制
      if (depth >= MAX_DEPTH) {
        if (Array.isArray(obj)) {
          return { type: 'array', length: obj.length, preview: `Array(${obj.length})` };
        }
        return { type: 'object', preview: '[Object]' };
      }

      // 处理数组
      if (Array.isArray(obj)) {
        const items = obj.slice(0, MAX_ARRAY_LENGTH).map((item) => {
          // 传递同一个 seen，确保跨层循环引用检测
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

      // 处理 TypedArray
      try {
        if (ArrayBuffer.isView(obj) && !(obj instanceof DataView)) {
          const typedArray = obj as unknown as { length: number; constructor: { name: string } };
          return {
            type: 'object',
            preview: `${typedArray.constructor.name}(${typedArray.length})`,
          };
        }
      } catch {
        // ignore
      }

      // 处理普通对象
      try {
        const keys = safeGetOwnPropertyNames(obj);
        const entries = keys.map((key) => {
          const val = safeGetProperty(obj, key);
          // 传递同一个 seen，确保跨层循环引用检测
          const serialized = serializeValue(val, depth + 1, seen);
          return `${key}: ${formatValueForPreview(serialized)}`;
        });
        const totalKeys = Object.keys(obj).length;
        const hasMore = totalKeys > MAX_OBJECT_KEYS;
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
    try {
      const err = new Error();
      const stack = err.stack;
      if (!stack) return undefined;
      // 移除前几行（Error 和 console 拦截器的调用）
      const lines = stack.split('\n').slice(3);
      return lines.join('\n');
    } catch {
      return undefined;
    }
  }

  /**
   * 安全地发送控制台事件 - 不会抛出异常
   */
  function emitConsoleEvent(data: ConsoleLogData) {
    try {
      window.dispatchEvent(
        new CustomEvent(CONSOLE_EVENT_NAME, {
          detail: data,
        })
      );
    } catch {
      // 静默失败，不影响主世界
    }
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
      // 先调用原始方法，确保主世界行为不受影响
      // 即使后续序列化失败，原始日志也已经输出
      const result = originalMethods[method](...args);

      // 异步处理序列化和事件发送，避免阻塞
      try {
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
      } catch {
        // 静默失败，不影响主世界
      }

      return result;
    };
  }
});
