import { NO_SPECIAL_CLONE, tryCloneSpecialObject } from './cloneSpecial.ts';

export const MAX_CLONE_DEPTH = 8;
export const MAX_CLONE_NODES = 200;
export const MAX_CLONE_STRING_LENGTH = 2_000;

const CLONE_TRUNCATED_MARK = '...[truncated]';

interface CloneBudget {
  nodes: number;
}

export function deepClone(
  value: unknown,
  path: string = '$',
  seen: Map<object, string> = new Map()
): unknown {
  return cloneWithBudget(value, path, seen, 0, { nodes: 0 });
}

function cloneWithBudget(
  value: unknown,
  path: string,
  seen: Map<object, string>,
  depth: number,
  budget: CloneBudget
): unknown {
  try {
    return deepCloneUnsafe(value, path, seen, depth, budget);
  } catch (error) {
    return {
      __error__: true,
      message: error instanceof Error ? error.message : String(error),
      path,
    };
  }
}

function truncatedClone(reason: 'depth-limit' | 'node-limit'): {
  __truncated__: true;
  reason: string;
} {
  return { __truncated__: true, reason };
}

function limitString(value: string): string {
  if (value.length <= MAX_CLONE_STRING_LENGTH) return value;
  const keep = Math.max(0, MAX_CLONE_STRING_LENGTH - CLONE_TRUNCATED_MARK.length);
  return `${value.slice(0, keep)}${CLONE_TRUNCATED_MARK}`;
}

function deepCloneUnsafe(
  value: unknown,
  path: string,
  seen: Map<object, string>,
  depth: number,
  budget: CloneBudget
): unknown {
  if (depth > MAX_CLONE_DEPTH) return truncatedClone('depth-limit');

  budget.nodes += 1;
  if (budget.nodes > MAX_CLONE_NODES) return truncatedClone('node-limit');

  if (value === null) return null;
  if (value === undefined) return { __type__: 'undefined' };

  const type = typeof value;

  if (type === 'string') {
    return limitString(value as string);
  }

  if (type === 'boolean') {
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
        source: limitString(fn.toString()),
      };
    } catch {
      return { __type__: 'function', name: 'anonymous' };
    }
  }

  if (type === 'bigint') {
    return { __type__: 'bigint', value: String(value) };
  }

  if (type !== 'object') {
    return { __type__: 'unknown', value: limitString(String(value)) };
  }

  const objectValue = value as object;
  if (seen.has(objectValue)) {
    return { __circular__: seen.get(objectValue) };
  }
  seen.set(objectValue, path);

  const cloneChild = (child: unknown, childPath: string, childSeen: Map<object, string>) =>
    cloneWithBudget(child, childPath, childSeen, depth + 1, budget);

  const specialClone = tryCloneSpecialObject(objectValue, path, seen, cloneChild);
  if (specialClone !== NO_SPECIAL_CLONE) {
    return specialClone;
  }

  if (Array.isArray(objectValue)) {
    return objectValue.map((item, index) => cloneChild(item, `${path}[${index}]`, seen));
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
          result[key] = cloneChild(descriptor.value, `${path}.${key}`, seen);
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
