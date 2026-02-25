/**
 * 控制台日志拦截脚本 - 注入到页面主世界执行
 * 此脚本会被打包为独立文件，通过 script 标签注入到页面
 *
 * 设计原则：
 * 1. 保证现场信息不丢失 - 完整深度克隆，无任何截断或限制
 * 2. 对主世界完全无感知 - 任何异常都不能影响原始 console 行为
 * 3. 不产生副作用 - 序列化过程不触发 getter、不修改对象
 * 4. 可完全恢复 - 停止录制时能还原所有被修改的 console 方法
 */

export default defineUnlistedScript(() => {
  // 防止重复注入
  if (
    (window as unknown as { __dppConsoleInterceptorInstalled?: boolean })
      .__dppConsoleInterceptorInstalled
  ) {
    return;
  }
  (
    window as unknown as { __dppConsoleInterceptorInstalled?: boolean }
  ).__dppConsoleInterceptorInstalled = true;

  // 控制台事件名称
  const CONSOLE_EVENT_NAME = 'dpp-console-log';
  // 恢复事件名称
  const CONSOLE_RESTORE_EVENT = 'dpp-console-restore';

  let logIdCounter = 0;

  function generateLogId(): string {
    return `console-${Date.now()}-${++logIdCounter}`;
  }

  /**
   * 深度克隆值 - 完整保留现场信息
   *
   * 返回一个可 JSON 序列化的深度克隆对象，包含类型信息
   * 循环引用会被标记为 { __circular__: path }
   */
  function deepClone(
    value: unknown,
    path: string = '$',
    seen: Map<object, string> = new Map()
  ): unknown {
    try {
      return deepCloneUnsafe(value, path, seen);
    } catch (e) {
      // 任何异常都返回错误信息，但不丢失上下文
      return {
        __error__: true,
        message: e instanceof Error ? e.message : String(e),
        path,
      };
    }
  }

  /**
   * 深度克隆的内部实现
   */
  function deepCloneUnsafe(value: unknown, path: string, seen: Map<object, string>): unknown {
    // 处理 null
    if (value === null) {
      return null;
    }

    // 处理 undefined
    if (value === undefined) {
      return { __type__: 'undefined' };
    }

    const type = typeof value;

    // 处理基本类型
    if (type === 'string') {
      return value;
    }

    if (type === 'number') {
      const num = value as number;
      if (Number.isNaN(num)) {
        return { __type__: 'number', value: 'NaN' };
      }
      if (!Number.isFinite(num)) {
        return { __type__: 'number', value: num > 0 ? 'Infinity' : '-Infinity' };
      }
      return num;
    }

    if (type === 'boolean') {
      return value;
    }

    if (type === 'symbol') {
      try {
        return { __type__: 'symbol', description: (value as symbol).description || '' };
      } catch {
        return { __type__: 'symbol', description: '' };
      }
    }

    if (type === 'function') {
      try {
        const fn = value as (...args: unknown[]) => unknown;
        return {
          __type__: 'function',
          name: fn.name || 'anonymous',
          source: fn.toString().slice(0, 500), // 保留函数源码前500字符
        };
      } catch {
        return { __type__: 'function', name: 'anonymous' };
      }
    }

    if (type === 'bigint') {
      return { __type__: 'bigint', value: String(value) };
    }

    // 处理对象类型
    if (type === 'object') {
      const obj = value as object;

      // 检查循环引用
      if (seen.has(obj)) {
        return { __circular__: seen.get(obj) };
      }

      // 记录当前路径
      seen.set(obj, path);

      // 处理 DOM 元素 - 提取关键信息
      try {
        if (obj instanceof Element) {
          const element = obj;
          const result: Record<string, unknown> = {
            __type__: 'Element',
            tagName: element.tagName,
            id: element.id || undefined,
            className: typeof element.className === 'string' ? element.className : undefined,
            attributes: {},
          };

          // 克隆所有属性
          for (let i = 0; i < element.attributes.length; i++) {
            const attr = element.attributes[i];
            (result.attributes as Record<string, string>)[attr.name] = attr.value;
          }

          // 保留 innerHTML 摘要（可能很大，限制一下）
          try {
            const html = element.innerHTML;
            result.innerHTML = html.length > 10000 ? html.slice(0, 10000) + '...[truncated]' : html;
          } catch {
            result.innerHTML = '[Unable to read innerHTML]';
          }

          // 保留文本内容
          try {
            const text = element.textContent;
            result.textContent =
              text && text.length > 1000 ? text.slice(0, 1000) + '...[truncated]' : text;
          } catch {
            result.textContent = '[Unable to read textContent]';
          }

          return result;
        }
      } catch {
        return { __type__: 'Element', error: 'Unable to serialize' };
      }

      // 处理 Error - 完整保留
      try {
        if (obj instanceof Error) {
          return {
            __type__: 'Error',
            name: obj.name,
            message: obj.message,
            stack: obj.stack,
            cause:
              obj.cause !== undefined ? deepClone(obj.cause, `${path}.cause`, seen) : undefined,
            // 克隆 Error 上的自定义属性
            ...Object.fromEntries(
              Object.keys(obj)
                .filter((k) => !['name', 'message', 'stack', 'cause'].includes(k))
                .map((k) => [
                  k,
                  deepClone((obj as unknown as Record<string, unknown>)[k], `${path}.${k}`, seen),
                ])
            ),
          };
        }
      } catch {
        return { __type__: 'Error', error: 'Unable to serialize' };
      }

      // 处理 Date
      try {
        if (obj instanceof Date) {
          return {
            __type__: 'Date',
            iso: obj.toISOString(),
            timestamp: obj.getTime(),
          };
        }
      } catch {
        return { __type__: 'Date', error: 'Invalid Date' };
      }

      // 处理 RegExp
      try {
        if (obj instanceof RegExp) {
          return {
            __type__: 'RegExp',
            source: obj.source,
            flags: obj.flags,
          };
        }
      } catch {
        return { __type__: 'RegExp', error: 'Unable to serialize' };
      }

      // 处理 Map - 完整克隆
      try {
        if (obj instanceof Map) {
          const entries: Array<{ key: unknown; value: unknown }> = [];
          let index = 0;
          for (const [k, v] of obj) {
            entries.push({
              key: deepClone(k, `${path}[Map.key.${index}]`, seen),
              value: deepClone(v, `${path}[Map.value.${index}]`, seen),
            });
            index++;
          }
          return {
            __type__: 'Map',
            size: obj.size,
            entries,
          };
        }
      } catch {
        return { __type__: 'Map', error: 'Unable to serialize' };
      }

      // 处理 Set - 完整克隆
      try {
        if (obj instanceof Set) {
          const values: unknown[] = [];
          let index = 0;
          for (const v of obj) {
            values.push(deepClone(v, `${path}[Set.${index}]`, seen));
            index++;
          }
          return {
            __type__: 'Set',
            size: obj.size,
            values,
          };
        }
      } catch {
        return { __type__: 'Set', error: 'Unable to serialize' };
      }

      // 处理 WeakMap/WeakSet - 无法枚举
      try {
        if (obj instanceof WeakMap) {
          return { __type__: 'WeakMap', note: 'Cannot enumerate WeakMap entries' };
        }
        if (obj instanceof WeakSet) {
          return { __type__: 'WeakSet', note: 'Cannot enumerate WeakSet values' };
        }
      } catch {
        // ignore
      }

      // 处理 Promise
      try {
        if (obj instanceof Promise) {
          return { __type__: 'Promise', state: 'pending' };
        }
      } catch {
        // ignore
      }

      // 处理 ArrayBuffer
      try {
        if (obj instanceof ArrayBuffer) {
          return {
            __type__: 'ArrayBuffer',
            byteLength: obj.byteLength,
            // 转换为数组以便查看内容
            data: Array.from(new Uint8Array(obj)),
          };
        }
      } catch {
        return { __type__: 'ArrayBuffer', error: 'Unable to serialize' };
      }

      // 处理 TypedArray
      try {
        if (ArrayBuffer.isView(obj) && !(obj instanceof DataView)) {
          const typedArray = obj as unknown as {
            length: number;
            constructor: { name: string };
            buffer: ArrayBuffer;
            byteOffset: number;
            byteLength: number;
          };
          return {
            __type__: typedArray.constructor.name,
            length: typedArray.length,
            byteOffset: typedArray.byteOffset,
            byteLength: typedArray.byteLength,
            // 转换为普通数组
            data: Array.from(obj as unknown as ArrayLike<number>),
          };
        }
      } catch {
        return { __type__: 'TypedArray', error: 'Unable to serialize' };
      }

      // 处理 DataView
      try {
        if (obj instanceof DataView) {
          return {
            __type__: 'DataView',
            byteLength: obj.byteLength,
            byteOffset: obj.byteOffset,
          };
        }
      } catch {
        return { __type__: 'DataView', error: 'Unable to serialize' };
      }

      // 处理数组 - 完整克隆，无长度限制
      if (Array.isArray(obj)) {
        return obj.map((item, index) => deepClone(item, `${path}[${index}]`, seen));
      }

      // 处理普通对象 - 完整克隆，无键数限制
      try {
        const result: Record<string, unknown> = {};

        // 获取所有自有属性（包括不可枚举的）
        const keys = Object.getOwnPropertyNames(obj);

        for (const key of keys) {
          try {
            const descriptor = Object.getOwnPropertyDescriptor(obj, key);

            if (descriptor) {
              if (typeof descriptor.get === 'function') {
                // 有 getter，标记但不触发
                result[key] = { __getter__: true };
              } else if ('value' in descriptor) {
                result[key] = deepClone(descriptor.value, `${path}.${key}`, seen);
              }
            }
          } catch (e) {
            result[key] = {
              __error__: true,
              message: e instanceof Error ? e.message : String(e),
            };
          }
        }

        // 保留原型链信息
        try {
          const proto = Object.getPrototypeOf(obj);
          if (proto && proto !== Object.prototype) {
            result.__proto_name__ = proto.constructor?.name || 'Unknown';
          }
        } catch {
          // ignore
        }

        return result;
      } catch {
        return { __type__: 'Object', error: 'Unable to serialize' };
      }
    }

    return { __type__: 'unknown', value: String(value) };
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

  interface ConsoleLogData {
    id: string;
    level: 'log' | 'info' | 'warn' | 'error' | 'debug' | 'trace';
    args: unknown[];
    timestamp: number;
    stack?: string;
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
      const result = originalMethods[method](...args);

      // 深度克隆并发送事件
      try {
        // 深度克隆所有参数
        const clonedArgs = args.map((arg, index) => deepClone(arg, `$[${index}]`));

        const logData: ConsoleLogData = {
          id: generateLogId(),
          level: method,
          args: clonedArgs,
          timestamp: Date.now(),
        };

        // 对于 trace 和 error，添加调用栈
        if (method === 'trace' || method === 'error') {
          logData.stack = getStack();
        }

        emitConsoleEvent(logData);
      } catch {
        // 静默失败，不影响主世界
      }

      return result;
    };
  }

  // ==================== 恢复机制 ====================

  /**
   * 恢复所有被修改的 console 方法到原始状态
   * 通过监听自定义事件触发，确保主世界可以完全恢复
   */
  function restore() {
    try {
      for (const method of CONSOLE_METHODS) {
        if (originalMethods[method]) {
          console[method] = originalMethods[method];
        }
      }
    } catch {
      // ignore
    }

    // 清除安装标记
    try {
      (
        window as unknown as { __dppConsoleInterceptorInstalled?: boolean }
      ).__dppConsoleInterceptorInstalled = false;
    } catch {
      // ignore
    }
  }

  // 监听恢复事件
  window.addEventListener(CONSOLE_RESTORE_EVENT, restore, { once: true });
});
