import { NetworkRequestCopyButton } from './NetworkRequestCopyButton';

interface NetworkRequestHeadersSectionProps {
  title: string;
  headers?: Record<string, string>;
}

export function NetworkRequestHeadersSection({
  title,
  headers,
}: NetworkRequestHeadersSectionProps) {
  if (!headers || Object.keys(headers).length === 0) {
    return (
      <div>
        <h4 className="font-medium mb-2">{title}</h4>
        <p className="text-muted-foreground text-xs">未录制</p>
      </div>
    );
  }

  const headersText = Object.entries(headers)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-medium">{title}</h4>
        <NetworkRequestCopyButton text={headersText} />
      </div>
      <div className="space-y-1">
        {Object.entries(headers).map(([key, value]) => (
          <div key={key} className="flex text-xs font-mono">
            <span className="text-muted-foreground min-w-[150px]">{key}:</span>
            <span className="break-all">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
