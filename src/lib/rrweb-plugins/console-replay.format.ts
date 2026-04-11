import type { ClonedValue } from './index';

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

export function formatClonedValue(value: ClonedValue, indent: number = 0): string {
  const spaces = '  '.repeat(indent);

  if (value === null) {
    return 'null';
  }

  if (typeof value === 'string') {
    return `"${value}"`;
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }
    if (value.length <= 5 && indent < 2) {
      const items = value.map((item) => formatClonedValue(item, indent + 1));
      const inline = `[${items.join(', ')}]`;
      if (inline.length < 80) {
        return inline;
      }
    }

    const items = value.map((item) => `${spaces}  ${formatClonedValue(item, indent + 1)}`);
    return `[
${items.join(',\n')}
${spaces}]`;
  }

  if (typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;

    if ('__type__' in objectValue) {
      const type = objectValue.__type__ as string;

      switch (type) {
        case 'undefined':
          return 'undefined';
        case 'number':
          return String(objectValue.value);
        case 'symbol':
          return `Symbol(${objectValue.description || ''})`;
        case 'function':
          return `ƒ ${objectValue.name || 'anonymous'}()`;
        case 'bigint':
          return `${objectValue.value}n`;
        case 'Element':
          return formatElement(objectValue);
        case 'Error':
          return formatError(objectValue);
        case 'Date':
          return `Date(${objectValue.iso})`;
        case 'RegExp':
          return `/${objectValue.source}/${objectValue.flags}`;
        case 'Map':
          return formatMap(objectValue, indent);
        case 'Set':
          return formatSet(objectValue, indent);
        case 'WeakMap':
          return 'WeakMap { }';
        case 'WeakSet':
          return 'WeakSet { }';
        case 'Promise':
          return 'Promise { <pending> }';
        case 'ArrayBuffer':
          return `ArrayBuffer(${objectValue.byteLength})`;
        default:
          if (type.endsWith('Array') && 'length' in objectValue) {
            return `${type}(${objectValue.length})`;
          }
          return `[${type}]`;
      }
    }

    if ('__circular__' in objectValue) {
      return `[Circular: ${objectValue.__circular__}]`;
    }

    if ('__error__' in objectValue) {
      return `[Error: ${objectValue.message}]`;
    }

    if ('__getter__' in objectValue) {
      return '[Getter]';
    }

    const keys = Object.keys(objectValue).filter((key) => !key.startsWith('__'));
    if (keys.length === 0) {
      return '{}';
    }

    if (keys.length <= 3 && indent < 2) {
      const entries = keys.map(
        (key) => `${key}: ${formatClonedValue(objectValue[key] as ClonedValue, indent + 1)}`
      );
      const inline = `{${entries.join(', ')}}`;
      if (inline.length < 80) {
        return inline;
      }
    }

    const entries = keys.map(
      (key) =>
        `${spaces}  ${key}: ${formatClonedValue(objectValue[key] as ClonedValue, indent + 1)}`
    );
    const protoName = objectValue.__proto_name__ as string | undefined;
    const prefix = protoName ? `${protoName} ` : '';
    return `${prefix}{
${entries.join(',\n')}
${spaces}}`;
  }

  return String(value);
}

function formatElement(obj: Record<string, unknown>): string {
  const tag = ((obj.tagName as string) || 'unknown').toLowerCase();
  const id = obj.id ? `#${obj.id}` : '';
  const className = obj.className
    ? `.${(obj.className as string).split(' ').filter(Boolean).join('.')}`
    : '';
  return `<${tag}${id}${className}>`;
}

function formatError(obj: Record<string, unknown>): string {
  return `${obj.name}: ${obj.message}`;
}

function formatMap(obj: Record<string, unknown>, indent: number): string {
  const entries = obj.entries as Array<{ key: ClonedValue; value: ClonedValue }> | undefined;
  if (!entries || entries.length === 0) {
    return `Map(${obj.size}) {}`;
  }

  const spaces = '  '.repeat(indent);
  const items = entries.map(
    (entry) =>
      `${spaces}  ${formatClonedValue(entry.key, indent + 1)} => ${formatClonedValue(entry.value, indent + 1)}`
  );
  return `Map(${obj.size}) {
${items.join(',\n')}
${spaces}}`;
}

function formatSet(obj: Record<string, unknown>, indent: number): string {
  const values = obj.values as ClonedValue[] | undefined;
  if (!values || values.length === 0) {
    return `Set(${obj.size}) {}`;
  }

  const spaces = '  '.repeat(indent);
  const items = values.map((value) => `${spaces}  ${formatClonedValue(value, indent + 1)}`);
  return `Set(${obj.size}) {
${items.join(',\n')}
${spaces}}`;
}
