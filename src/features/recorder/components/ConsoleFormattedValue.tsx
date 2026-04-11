import { ConsoleFormattedCollectionValue } from '@/features/recorder/components/ConsoleFormattedCollectionValue';
import {
  ConsoleFormattedSpecialValue,
  hasConsoleFormattedSpecialValue,
} from '@/features/recorder/components/ConsoleFormattedSpecialValue';
import {
  type FormattedArgsProps,
  type FormattedValueProps,
} from '@/features/recorder/components/consolePanelShared';
import { cn } from '@/utils/cn';

export function FormattedArgs({ args, isFuture, expanded }: FormattedArgsProps) {
  return (
    <>
      {args.map((arg, index) => (
        <span key={index}>
          {index > 0 && ' '}
          <FormattedValue value={arg} isFuture={isFuture} expanded={expanded} />
        </span>
      ))}
    </>
  );
}

export function FormattedValue({ value, isFuture, expanded }: FormattedValueProps) {
  const baseClass = isFuture ? 'text-muted-foreground' : '';

  if (value === null) {
    return <span className={cn(baseClass, !isFuture && 'text-muted-foreground italic')}>null</span>;
  }

  if (typeof value === 'string') {
    return <span className={cn(baseClass, !isFuture && 'text-console-log')}>"{value}"</span>;
  }

  if (typeof value === 'number') {
    return <span className={cn(baseClass, !isFuture && 'text-console-info')}>{value}</span>;
  }

  if (typeof value === 'boolean') {
    return (
      <span className={cn(baseClass, !isFuture && 'text-console-debug')}>{String(value)}</span>
    );
  }

  if (Array.isArray(value)) {
    return (
      <ConsoleFormattedCollectionValue
        value={value}
        isFuture={isFuture}
        expanded={expanded}
        renderValue={(item) => (
          <FormattedValue value={item} isFuture={isFuture} expanded={expanded} />
        )}
      />
    );
  }

  if (typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;

    if (hasConsoleFormattedSpecialValue(objectValue)) {
      return <ConsoleFormattedSpecialValue value={objectValue} isFuture={isFuture} />;
    }

    return (
      <ConsoleFormattedCollectionValue
        value={objectValue}
        isFuture={isFuture}
        expanded={expanded}
        renderValue={(item) => (
          <FormattedValue value={item} isFuture={isFuture} expanded={expanded} />
        )}
      />
    );
  }

  return <span className={baseClass}>{String(value)}</span>;
}
