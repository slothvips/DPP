export type DeepCloneFn = (value: unknown, path: string, seen: Map<object, string>) => unknown;

export const NO_SPECIAL_CLONE = Symbol('NO_SPECIAL_CLONE');

export function tryCloneSpecialObject(
  objectValue: object,
  path: string,
  seen: Map<object, string>,
  clone: DeepCloneFn
): unknown {
  try {
    if (objectValue instanceof Element) {
      const result: Record<string, unknown> = {
        __type__: 'Element',
        tagName: objectValue.tagName,
        id: objectValue.id || undefined,
        className: typeof objectValue.className === 'string' ? objectValue.className : undefined,
        attributes: {},
      };

      for (let index = 0; index < objectValue.attributes.length; index++) {
        const attr = objectValue.attributes[index];
        (result.attributes as Record<string, string>)[attr.name] = attr.value;
      }

      try {
        const html = objectValue.innerHTML;
        result.innerHTML = html.length > 10000 ? `${html.slice(0, 10000)}...[truncated]` : html;
      } catch {
        result.innerHTML = '[Unable to read innerHTML]';
      }

      try {
        const text = objectValue.textContent;
        result.textContent =
          text && text.length > 1000 ? `${text.slice(0, 1000)}...[truncated]` : text;
      } catch {
        result.textContent = '[Unable to read textContent]';
      }

      return result;
    }
  } catch {
    return { __type__: 'Element', error: 'Unable to serialize' };
  }

  try {
    if (objectValue instanceof Error) {
      return {
        __type__: 'Error',
        name: objectValue.name,
        message: objectValue.message,
        stack: objectValue.stack,
        cause:
          objectValue.cause !== undefined
            ? clone(objectValue.cause, `${path}.cause`, seen)
            : undefined,
        ...Object.fromEntries(
          Object.keys(objectValue)
            .filter((key) => !['name', 'message', 'stack', 'cause'].includes(key))
            .map((key) => [
              key,
              clone(
                (objectValue as unknown as Record<string, unknown>)[key],
                `${path}.${key}`,
                seen
              ),
            ])
        ),
      };
    }
  } catch {
    return { __type__: 'Error', error: 'Unable to serialize' };
  }

  try {
    if (objectValue instanceof Date) {
      return { __type__: 'Date', iso: objectValue.toISOString(), timestamp: objectValue.getTime() };
    }
  } catch {
    return { __type__: 'Date', error: 'Invalid Date' };
  }

  try {
    if (objectValue instanceof RegExp) {
      return { __type__: 'RegExp', source: objectValue.source, flags: objectValue.flags };
    }
  } catch {
    return { __type__: 'RegExp', error: 'Unable to serialize' };
  }

  try {
    if (objectValue instanceof Map) {
      const entries: Array<{ key: unknown; value: unknown }> = [];
      let index = 0;
      for (const [key, item] of objectValue) {
        entries.push({
          key: clone(key, `${path}[Map.key.${index}]`, seen),
          value: clone(item, `${path}[Map.value.${index}]`, seen),
        });
        index++;
      }
      return { __type__: 'Map', size: objectValue.size, entries };
    }
  } catch {
    return { __type__: 'Map', error: 'Unable to serialize' };
  }

  try {
    if (objectValue instanceof Set) {
      const values: unknown[] = [];
      let index = 0;
      for (const item of objectValue) {
        values.push(clone(item, `${path}[Set.${index}]`, seen));
        index++;
      }
      return { __type__: 'Set', size: objectValue.size, values };
    }
  } catch {
    return { __type__: 'Set', error: 'Unable to serialize' };
  }

  try {
    if (objectValue instanceof WeakMap) {
      return { __type__: 'WeakMap', note: 'Cannot enumerate WeakMap entries' };
    }
    if (objectValue instanceof WeakSet) {
      return { __type__: 'WeakSet', note: 'Cannot enumerate WeakSet values' };
    }
  } catch {
    // ignore
  }

  try {
    if (objectValue instanceof Promise) {
      return { __type__: 'Promise', state: 'pending' };
    }
  } catch {
    // ignore
  }

  try {
    if (objectValue instanceof ArrayBuffer) {
      return {
        __type__: 'ArrayBuffer',
        byteLength: objectValue.byteLength,
        data: Array.from(new Uint8Array(objectValue)),
      };
    }
  } catch {
    return { __type__: 'ArrayBuffer', error: 'Unable to serialize' };
  }

  try {
    if (ArrayBuffer.isView(objectValue) && !(objectValue instanceof DataView)) {
      const typedArray = objectValue as unknown as {
        length: number;
        constructor: { name: string };
        byteOffset: number;
        byteLength: number;
      };
      return {
        __type__: typedArray.constructor.name,
        length: typedArray.length,
        byteOffset: typedArray.byteOffset,
        byteLength: typedArray.byteLength,
        data: Array.from(objectValue as unknown as ArrayLike<number>),
      };
    }
  } catch {
    return { __type__: 'TypedArray', error: 'Unable to serialize' };
  }

  try {
    if (objectValue instanceof DataView) {
      return {
        __type__: 'DataView',
        byteLength: objectValue.byteLength,
        byteOffset: objectValue.byteOffset,
      };
    }
  } catch {
    return { __type__: 'DataView', error: 'Unable to serialize' };
  }

  return NO_SPECIAL_CLONE;
}
