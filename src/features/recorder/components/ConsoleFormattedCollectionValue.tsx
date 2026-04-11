import type { ClonedValue } from '@/lib/rrweb-plugins';
import { cn } from '@/utils/cn';

interface ConsoleFormattedCollectionValueProps {
  value: ClonedValue[] | Record<string, unknown>;
  isFuture?: boolean;
  expanded?: boolean;
  renderValue: (value: ClonedValue) => React.ReactNode;
}

export function ConsoleFormattedCollectionValue({
  value,
  isFuture,
  expanded,
  renderValue,
}: ConsoleFormattedCollectionValueProps) {
  const baseClass = isFuture ? 'text-muted-foreground' : '';

  if (Array.isArray(value)) {
    if (expanded) {
      return (
        <span className={baseClass}>
          <span className="text-muted-foreground">[</span>
          {value.map((item, index) => (
            <span key={index}>
              {index > 0 && <span className="text-muted-foreground">, </span>}
              {renderValue(item)}
            </span>
          ))}
          <span className="text-muted-foreground">]</span>
        </span>
      );
    }

    return (
      <span className={cn(baseClass, !isFuture && 'text-foreground')}>Array({value.length})</span>
    );
  }

  const keys = Object.keys(value).filter((key) => !key.startsWith('__'));

  if (expanded) {
    return (
      <span className={baseClass}>
        <span className="text-muted-foreground">{'{'}</span>
        {keys.map((key, index) => (
          <span key={key}>
            {index > 0 && <span className="text-muted-foreground">, </span>}
            <span className="text-console-debug">{key}</span>
            <span className="text-muted-foreground">: </span>
            {renderValue(value[key] as ClonedValue)}
          </span>
        ))}
        <span className="text-muted-foreground">{'}'}</span>
      </span>
    );
  }

  const protoName = value.__proto_name__ as string | undefined;
  return (
    <span className={cn(baseClass, !isFuture && 'text-foreground')}>
      {protoName ? `${protoName} ` : ''}
      {'{'}...{'}'}
    </span>
  );
}
