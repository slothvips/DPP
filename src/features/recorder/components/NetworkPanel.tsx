import { useMemo, useState } from 'react';
import { usePanelResize } from '@/hooks/usePanelResize';
import {
  type NetworkRequest,
  extractNetworkRequests,
  formatDuration,
  getMethodColor,
  getStatusColor,
} from '@/lib/rrweb-plugins';
import { cn } from '@/utils/cn';
import type { eventWithTime } from '@rrweb/types';

type NetworkRequestWithTimestamp = NetworkRequest & { eventTimestamp: number };

interface NetworkPanelProps {
  events: eventWithTime[];
  currentTime?: number;
}

type RequestStatus = 'past' | 'active' | 'future';

export function NetworkPanel({ events, currentTime }: NetworkPanelProps) {
  const [selectedRequest, setSelectedRequest] = useState<NetworkRequestWithTimestamp | null>(null);
  const [filter, setFilter] = useState('');

  const {
    value: leftPanelWidth,
    containerRef,
    handleProps,
  } = usePanelResize({
    initialValue: 50,
    min: 20,
    max: 80,
    unit: 'percent',
  });

  const requests = extractNetworkRequests(events);

  // 找到第一个有效的时间戳作为录制开始时间
  const recordingStartTime = useMemo(() => {
    for (const event of events) {
      if (event.timestamp && event.timestamp > 0) {
        return event.timestamp;
      }
    }
    return 0;
  }, [events]);

  // 按事件时间戳排序请求
  const sortedRequests = useMemo(() => {
    return [...requests].sort((a, b) => a.eventTimestamp - b.eventTimestamp);
  }, [requests]);

  const filteredRequests = sortedRequests.filter((req) => {
    if (!filter) return true;
    const lowerFilter = filter.toLowerCase();
    return (
      req.url.toLowerCase().includes(lowerFilter) ||
      req.method.toLowerCase().includes(lowerFilter) ||
      String(req.status).includes(lowerFilter)
    );
  });

  // 获取请求相对于录制开始的时间（毫秒）
  const getRelativeTime = (eventTimestamp: number) => {
    return eventTimestamp - recordingStartTime;
  };

  // 判断请求状态：past（已完成）、active（进行中）、future（未发生）
  const getRequestStatus = (req: NetworkRequestWithTimestamp): RequestStatus => {
    if (currentTime === undefined) return 'past';
    const relativeTime = getRelativeTime(req.eventTimestamp);
    // 请求持续时间，如果没有则假设 1 秒
    const duration = req.duration || 1000;

    if (currentTime < relativeTime - duration) return 'future';
    if (currentTime >= relativeTime - duration && currentTime <= relativeTime) return 'active';
    return 'past';
  };

  // 格式化时间点显示
  const formatTimePoint = (eventTimestamp: number) => {
    const relativeMs = getRelativeTime(eventTimestamp);
    if (relativeMs < 0) return '00:00.000';
    const totalSeconds = Math.floor(relativeMs / 1000);
    const ms = Math.floor(relativeMs % 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  // 统计各状态请求数量
  const statusCounts = useMemo(() => {
    const counts = { past: 0, active: 0, future: 0 };
    filteredRequests.forEach((req) => {
      counts[getRequestStatus(req)]++;
    });
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredRequests, currentTime]);

  return (
    <div className="flex flex-col h-full bg-background text-foreground text-sm">
      {/* 工具栏 */}
      <div className="flex items-center gap-2 p-2 border-b bg-muted/30">
        <input
          type="text"
          placeholder="过滤请求..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="flex-1 px-2 py-1 text-sm border rounded bg-background"
        />
        <div className="flex items-center gap-2 text-xs">
          <span className="text-green-600">{statusCounts.past}</span>
          <span className="text-muted-foreground">/</span>
          <span className="text-blue-600">{statusCounts.active}</span>
          <span className="text-muted-foreground">/</span>
          <span className="text-muted-foreground/50">{statusCounts.future}</span>
        </div>
      </div>

      <div ref={containerRef} className="flex flex-1 min-h-0">
        {/* 请求列表 */}
        <div className="overflow-auto" style={{ width: `${leftPanelWidth}%` }}>
          {filteredRequests.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              {requests.length === 0 ? '没有录制到网络请求' : '没有匹配的请求'}
            </div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 bg-muted/50 text-xs z-10">
                <tr>
                  <th className="text-left p-2 font-medium">URL</th>
                  <th className="text-left p-2 font-medium w-[50px]">方法</th>
                  <th className="text-left p-2 font-medium w-[45px]">状态</th>
                  <th className="text-left p-2 font-medium w-[70px]">时间</th>
                  <th className="text-right p-2 font-medium w-[60px]">耗时</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((req) => {
                  const status = getRequestStatus(req);
                  const isFuture = status === 'future';
                  const isActive = status === 'active';

                  return (
                    <tr
                      key={req.id}
                      onClick={() => setSelectedRequest(req)}
                      className={cn(
                        'cursor-pointer border-b border-border/50 transition-colors',
                        selectedRequest?.id === req.id && 'bg-muted',
                        isActive && 'bg-blue-500/20 border-l-2 border-l-blue-500',
                        isFuture && 'opacity-40',
                        !isFuture && !isActive && 'hover:bg-muted/50',
                        req.error && !isFuture && 'bg-red-500/10'
                      )}
                    >
                      <td
                        className={cn(
                          'p-2 truncate max-w-[180px]',
                          isFuture && 'text-muted-foreground/50'
                        )}
                        title={req.url}
                      >
                        {(() => {
                          try {
                            return new URL(req.url, 'http://localhost').pathname;
                          } catch {
                            return req.url;
                          }
                        })()}
                      </td>
                      <td
                        className={cn(
                          'p-2 font-mono text-xs',
                          isFuture ? 'text-muted-foreground/50' : getMethodColor(req.method)
                        )}
                      >
                        {req.method}
                      </td>
                      <td
                        className={cn(
                          'p-2 font-mono text-xs',
                          isFuture ? 'text-muted-foreground/50' : getStatusColor(req.status)
                        )}
                      >
                        {isFuture ? '-' : req.status || (req.error ? 'ERR' : '...')}
                      </td>
                      <td
                        className={cn(
                          'p-2 font-mono text-xs',
                          isFuture ? 'text-muted-foreground/50' : 'text-muted-foreground'
                        )}
                      >
                        {formatTimePoint(req.eventTimestamp)}
                      </td>
                      <td
                        className={cn(
                          'p-2 text-right text-xs',
                          isFuture ? 'text-muted-foreground/50' : 'text-muted-foreground'
                        )}
                      >
                        {isFuture ? '-' : formatDuration(req.duration)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* 拖拽分隔条 */}
        <div {...handleProps} />

        {/* 请求详情 */}
        <div className="overflow-auto flex-1 min-w-0">
          {selectedRequest ? (
            <RequestDetail
              request={selectedRequest}
              isFuture={getRequestStatus(selectedRequest) === 'future'}
            />
          ) : (
            <div className="p-4 text-center text-muted-foreground">选择一个请求查看详情</div>
          )}
        </div>
      </div>
    </div>
  );
}

interface RequestDetailProps {
  request: NetworkRequest;
  isFuture?: boolean;
}

function RequestDetail({ request, isFuture }: RequestDetailProps) {
  const [activeTab, setActiveTab] = useState<'headers' | 'request' | 'response'>('headers');

  if (isFuture) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="w-12 h-12 mb-4 rounded-full bg-muted/50 flex items-center justify-center">
          <svg
            className="w-6 h-6 text-muted-foreground/50"
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
        <p className="text-muted-foreground/70 text-sm">此请求尚未发生</p>
        <p className="text-muted-foreground/50 text-xs mt-1">播放到对应时间点后可查看详情</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 基本信息 */}
      <div className="p-3 border-b bg-muted/30">
        <div className="flex items-center gap-2 mb-1">
          <span className={cn('font-mono font-medium', getMethodColor(request.method))}>
            {request.method}
          </span>
          <span className={cn('font-mono', getStatusColor(request.status))}>
            {request.status} {request.statusText}
          </span>
        </div>
        <div className="flex items-start gap-2">
          <div className="text-xs text-muted-foreground break-all flex-1">{request.url}</div>
          <CopyButton text={request.url} label="复制 URL" />
        </div>
        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
          <span>类型: {request.type.toUpperCase()}</span>
          <span>耗时: {formatDuration(request.duration)}</span>
        </div>
        {request.error && (
          <div className="mt-2 text-xs text-red-600 bg-red-500/10 p-2 rounded">
            错误: {request.error}
          </div>
        )}
      </div>

      {/* 标签页 */}
      <div className="flex border-b">
        {(['headers', 'request', 'response'] as const).map((tab) => (
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
            {tab === 'headers' ? '头部' : tab === 'request' ? '请求体' : '响应体'}
          </button>
        ))}
      </div>

      {/* 内容 */}
      <div className="flex-1 overflow-auto p-3">
        {activeTab === 'headers' && (
          <div className="space-y-4">
            <HeadersSection title="请求头" headers={request.requestHeaders} />
            <HeadersSection title="响应头" headers={request.responseHeaders} />
          </div>
        )}

        {activeTab === 'request' && <BodySection body={request.requestBody} />}

        {activeTab === 'response' && (
          <BodySection body={request.responseBody} contentType={request.responseType} />
        )}
      </div>
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
      title={label || '复制'}
    >
      {copied ? (
        <svg
          className="w-3.5 h-3.5 text-green-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      )}
    </button>
  );
}

function HeadersSection({ title, headers }: { title: string; headers?: Record<string, string> }) {
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
        <CopyButton text={headersText} />
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

function BodySection({ body, contentType }: { body?: string; contentType?: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const PREVIEW_LENGTH = 2000;

  if (!body) {
    return <p className="text-muted-foreground text-xs">未录制或无内容</p>;
  }

  // 尝试格式化 JSON
  let formattedBody = body;
  const isJson =
    contentType?.includes('application/json') || body.startsWith('{') || body.startsWith('[');

  if (isJson) {
    try {
      formattedBody = JSON.stringify(JSON.parse(body), null, 2);
    } catch {
      // 保持原样
    }
  }

  const isLong = formattedBody.length > PREVIEW_LENGTH;
  const displayBody =
    isLong && !isExpanded ? formattedBody.slice(0, PREVIEW_LENGTH) : formattedBody;

  return (
    <div className="relative group">
      <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        {isLong && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
            title={isExpanded ? '收起' : '展开全部'}
          >
            {isExpanded ? (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 15l7-7 7 7"
                />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            )}
          </button>
        )}
        <CopyButton text={body} />
      </div>
      <pre className="text-xs font-mono whitespace-pre-wrap break-all bg-muted/30 p-2 rounded max-h-[500px] overflow-auto">
        {displayBody}
        {isLong && !isExpanded && (
          <span className="text-muted-foreground">
            {'\n'}... [{((formattedBody.length - PREVIEW_LENGTH) / 1024).toFixed(1)} KB 已折叠]
          </span>
        )}
      </pre>
    </div>
  );
}
