import { NO_SPECIAL_CLONE, tryCloneSpecialObject } from './cloneSpecial';

export function deepClone(
  value: unknown,
  path: string = '$',
  seen: Map<object, string> = new Map()
): unknown {
  try {
    return deepCloneUnsafe(value, path, seen);
  } catch (error) {
    return {
      __error__: true,
      message: error instanceof Error ? error.message : String(error),
      path,
    };
  }
}

function deepCloneUnsafe(value: unknown, path: string, seen: Map<object, string>): unknown {
  if (value === null) return null;
  if (value === undefined) return { __type__: 'undefined' };

  const type = typeof value;

  if (type === 'string' || type === 'boolean') {
    return value;
  }

  if (type === 'number') {
    const numberValue = value as number;
    if (Number.isNaN(numberValue)) return { __type__: 'number', value: 'NaN' };
    if (!Number.isFinite(numberValue)) {
      return { __type__: 'number', value: numberValue > 0 ? 'Infinity' : '-Infinity' };
    }
    return numberValue;
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
        source: fn.toString().slice(0, 500),
      };
    } catch {
      return { __type__: 'function', name: 'anonymous' };
    }
  }

  if (type === 'bigint') {
    return { __type__: 'bigint', value: String(value) };
  }

  if (type !== 'object') {
    return { __type__: 'unknown', value: String(value) };
  }

  const objectValue = value as object;
  if (seen.has(objectValue)) {
    return { __circular__: seen.get(objectValue) };
  }
  seen.set(objectValue, path);

  const specialClone = tryCloneSpecialObject(objectValue, path, seen, deepClone);
  if (specialClone !== NO_SPECIAL_CLONE) {
    return specialClone;
  }

  if (Array.isArray(objectValue)) {
    return objectValue.map((item, index) => deepClone(item, `${path}[${index}]`, seen));
  }

  try {
    const result: Record<string, unknown> = {};
    const keys = Object.getOwnPropertyNames(objectValue);

    for (const key of keys) {
      try {
        const descriptor = Object.getOwnPropertyDescriptor(objectValue, key);
        if (!descriptor) continue;
        if (typeof descriptor.get === 'function') {
          result[key] = { __getter__: true };
        } else if ('value' in descriptor) {
          result[key] = deepClone(descriptor.value, `${path}.${key}`, seen);
        }
      } catch (error) {
        result[key] = {
          __error__: true,
          message: error instanceof Error ? error.message : String(error),
        };
      }
    }

    try {
      const proto = Object.getPrototypeOf(objectValue);
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
