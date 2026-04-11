import { cn } from '@/utils/cn';

interface ConsoleFormattedSpecialValueProps {
  value: Record<string, unknown>;
  isFuture?: boolean;
}

export function hasConsoleFormattedSpecialValue(value: Record<string, unknown>) {
  return (
    '__type__' in value || '__circular__' in value || '__error__' in value || '__getter__' in value
  );
}

export function ConsoleFormattedSpecialValue({
  value,
  isFuture,
}: ConsoleFormattedSpecialValueProps) {
  const baseClass = isFuture ? 'text-muted-foreground' : '';

  if ('__type__' in value) {
    const type = value.__type__ as string;

    switch (type) {
      case 'undefined':
        return (
          <span className={cn(baseClass, !isFuture && 'text-muted-foreground italic')}>
            undefined
          </span>
        );
      case 'number':
        return (
          <span className={cn(baseClass, !isFuture && 'text-console-info')}>
            {String(value.value)}
          </span>
        );
      case 'symbol':
        return (
          <span className={cn(baseClass, !isFuture && 'text-console-warn')}>
            Symbol({(value.description as string) || ''})
          </span>
        );
      case 'function':
        return (
          <span className={cn(baseClass, !isFuture && 'text-console-trace')}>
            ƒ {(value.name as string) || 'anonymous'}()
          </span>
        );
      case 'bigint':
        return (
          <span className={cn(baseClass, !isFuture && 'text-console-info')}>
            {String(value.value)}n
          </span>
        );
      case 'Element':
        return (
          <span className={cn(baseClass, !isFuture && 'text-console-debug')}>
            &lt;{((value.tagName as string) || 'unknown').toLowerCase()}
            {value.id ? `#${String(value.id)}` : ''}
            {value.className
              ? `.${(value.className as string).split(' ').filter(Boolean).join('.')}`
              : ''}
            &gt;
          </span>
        );
      case 'Error':
        return (
          <span className={cn(baseClass, !isFuture && 'text-console-error')}>
            {String(value.name)}: {String(value.message)}
          </span>
        );
      case 'Date':
        return (
          <span className={cn(baseClass, !isFuture && 'text-foreground')}>
            Date({String(value.iso)})
          </span>
        );
      case 'RegExp':
        return (
          <span className={cn(baseClass, !isFuture && 'text-destructive')}>
            /{String(value.source)}/{String(value.flags)}
          </span>
        );
      case 'Map':
        return (
          <span className={cn(baseClass, !isFuture && 'text-foreground')}>
            Map({String(value.size)})
          </span>
        );
      case 'Set':
        return (
          <span className={cn(baseClass, !isFuture && 'text-foreground')}>
            Set({String(value.size)})
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
            ArrayBuffer({String(value.byteLength)})
          </span>
        );
      default:
        if (type.endsWith('Array') && 'length' in value) {
          return (
            <span className={cn(baseClass, !isFuture && 'text-foreground')}>
              {type}({String(value.length)})
            </span>
          );
        }
        return <span className={cn(baseClass, !isFuture && 'text-foreground')}>[{type}]</span>;
    }
  }

  if ('__circular__' in value) {
    return (
      <span className={cn(baseClass, !isFuture && 'text-console-warn')}>
        [Circular: {String(value.__circular__)}]
      </span>
    );
  }

  if ('__error__' in value) {
    return (
      <span className={cn(baseClass, !isFuture && 'text-console-error')}>
        [Error: {String(value.message)}]
      </span>
    );
  }

  if ('__getter__' in value) {
    return <span className={cn(baseClass, !isFuture && 'text-muted-foreground')}>[Getter]</span>;
  }

  return null;
}
