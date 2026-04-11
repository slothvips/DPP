import { Allotment } from 'allotment';
import { useState } from 'react';
import {
  BodySection,
  CopyButton,
  HeadersSection,
  StreamChunksSection,
} from '@/features/recorder/components/NetworkRequestSections';
import {
  type NetworkRequest,
  formatDuration,
  formatSize,
  getMethodColor,
  getRequestPhaseLabel,
  getStatusColor,
} from '@/lib/rrweb-plugins';
import { cn } from '@/utils/cn';

interface NetworkRequestDetailProps {
  request: NetworkRequest;
  isFuture?: boolean;
}

export function NetworkRequestDetail({ request, isFuture }: NetworkRequestDetailProps) {
  const [activeTab, setActiveTab] = useState<'headers' | 'request' | 'response' | 'stream'>(
    request.isStreaming ? 'stream' : 'headers'
  );

  const tabs = request.isStreaming
    ? (['headers', 'request', 'response', 'stream'] as const)
    : (['headers', 'request', 'response'] as const);

  const tabLabels: Record<(typeof tabs)[number], string> = {
    headers: '头部',
    request: '请求体',
    response: '响应体',
    stream: '流式数据',
  };

  if (isFuture) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="w-12 h-12 mb-4 rounded-full bg-muted/50 flex items-center justify-center">
          <svg
            className="w-6 h-6 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <p className="text-muted-foreground text-sm">此请求尚未发生</p>
        <p className="text-muted-foreground text-xs mt-1">播放到对应时间点后可查看详情</p>
      </div>
    );
  }

  return (
    <Allotment vertical className="h-full">
      <Allotment.Pane preferredSize={120} minSize={80}>
        <div className="h-full overflow-auto p-3 bg-muted/30">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn('font-mono font-medium', getMethodColor(request.method))}>
              {request.method}
            </span>
            {request.status ? (
              <span className={cn('font-mono', getStatusColor(request.status))}>
                {request.status} {request.statusText}
              </span>
            ) : (
              <span className="text-muted-foreground text-xs">
                {getRequestPhaseLabel(request.phase)}
              </span>
            )}
            {request.isStreaming && (
              <span className="px-1.5 py-0.5 text-xs bg-purple-500/20 text-purple-600 rounded">
                流式
              </span>
            )}
            {request.type === 'sse' && (
              <span className="px-1.5 py-0.5 text-xs bg-orange-500/20 text-orange-600 rounded">
                SSE
              </span>
            )}
          </div>
          <div className="flex items-start gap-2">
            <div className="text-xs text-muted-foreground break-all flex-1">{request.url}</div>
            <CopyButton text={request.url} label="复制 URL" />
          </div>
          <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
            <span>类型: {request.type.toUpperCase()}</span>
            {request.duration !== undefined && (
              <span>耗时: {formatDuration(request.duration)}</span>
            )}
            {request.receivedBytes !== undefined && (
              <span>已接收: {formatSize(request.receivedBytes)}</span>
            )}
            {request.streamChunks && <span>数据块: {request.streamChunks.length}</span>}
          </div>
          {request.error && (
            <div className="mt-2 text-xs text-destructive bg-destructive/10 dark:bg-destructive/20 p-2 rounded">
              错误: {request.error}
            </div>
          )}
        </div>
      </Allotment.Pane>

      <Allotment.Pane minSize={100}>
        <div className="flex flex-col h-full">
          <div className="flex border-b">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'px-4 py-2 text-sm',
                  activeTab === tab
                    ? 'border-b-2 border-primary text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tabLabels[tab]}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-hidden">
            {activeTab === 'headers' && (
              <Allotment vertical className="h-full">
                <Allotment.Pane preferredSize="50%" minSize={50}>
                  <div className="h-full overflow-auto p-3">
                    <HeadersSection title="请求头" headers={request.requestHeaders} />
                  </div>
                </Allotment.Pane>
                <Allotment.Pane minSize={50}>
                  <div className="h-full overflow-auto p-3">
                    <HeadersSection title="响应头" headers={request.responseHeaders} />
                  </div>
                </Allotment.Pane>
              </Allotment>
            )}

            {activeTab === 'request' && (
              <div className="h-full overflow-auto p-3">
                <BodySection body={request.requestBody} />
              </div>
            )}

            {activeTab === 'response' && (
              <div className="h-full overflow-auto p-3">
                <BodySection body={request.responseBody} contentType={request.responseType} />
              </div>
            )}

            {activeTab === 'stream' && request.streamChunks && (
              <div className="h-full overflow-auto p-3">
                <StreamChunksSection chunks={request.streamChunks} />
              </div>
            )}
          </div>
        </div>
      </Allotment.Pane>
    </Allotment>
  );
}
