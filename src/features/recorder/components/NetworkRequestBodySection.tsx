import { useState } from 'react';
import { NetworkRequestCopyButton } from './NetworkRequestCopyButton';

const BODY_PREVIEW_LENGTH = 2000;

interface NetworkRequestBodySectionProps {
  body?: string;
  contentType?: string;
}

export function NetworkRequestBodySection({ body, contentType }: NetworkRequestBodySectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!body) {
    return <p className="text-muted-foreground text-xs">未录制或无内容</p>;
  }

  let formattedBody = body;
  const isJson =
    contentType?.includes('application/json') || body.startsWith('{') || body.startsWith('[');

  if (isJson) {
    try {
      formattedBody = JSON.stringify(JSON.parse(body), null, 2);
    } catch {
      // keep raw body
    }
  }

  const isLong = formattedBody.length > BODY_PREVIEW_LENGTH;
  const displayBody =
    isLong && !isExpanded ? formattedBody.slice(0, BODY_PREVIEW_LENGTH) : formattedBody;

  return (
    <div className="relative group">
      <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        {isLong && (
          <button
            onClick={() => setIsExpanded((expanded) => !expanded)}
            className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
            title={isExpanded ? '收起' : '展开全部'}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={isExpanded ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'}
              />
            </svg>
          </button>
        )}
        <NetworkRequestCopyButton text={body} />
      </div>
      <pre className="text-xs font-mono whitespace-pre-wrap break-all bg-muted/30 p-2 rounded max-h-[500px] overflow-auto">
        {displayBody}
        {isLong && !isExpanded && (
          <span className="text-muted-foreground">
            {'\n'}... [{((formattedBody.length - BODY_PREVIEW_LENGTH) / 1024).toFixed(1)} KB 已折叠]
          </span>
        )}
      </pre>
    </div>
  );
}
