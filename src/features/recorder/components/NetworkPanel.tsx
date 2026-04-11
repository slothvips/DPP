import { Allotment } from 'allotment';
import { useMemo, useState } from 'react';
import { NetworkPanelToolbar } from '@/features/recorder/components/NetworkPanelToolbar';
import { NetworkRequestDetail } from '@/features/recorder/components/NetworkRequestDetail';
import { NetworkRequestList } from '@/features/recorder/components/NetworkRequestList';
import {
  type NetworkPanelProps,
  type NetworkRequestWithTimestamp,
  getRecordingStartTime,
  getRequestStatus,
} from '@/features/recorder/components/networkPanelShared';
import { extractNetworkRequests } from '@/lib/rrweb-plugins';

export function NetworkPanel({ events, currentTime }: NetworkPanelProps) {
  const [selectedRequest, setSelectedRequest] = useState<NetworkRequestWithTimestamp | null>(null);
  const [filter, setFilter] = useState('');

  const requests = extractNetworkRequests(events);
  const recordingStartTime = useMemo(() => getRecordingStartTime(events), [events]);

  const sortedRequests = useMemo(
    () => [...requests].sort((left, right) => left.eventTimestamp - right.eventTimestamp),
    [requests]
  );

  const filteredRequests = useMemo(() => {
    if (!filter) {
      return sortedRequests;
    }

    const lowerFilter = filter.toLowerCase();
    return sortedRequests.filter((request) => {
      return (
        request.url.toLowerCase().includes(lowerFilter) ||
        request.method.toLowerCase().includes(lowerFilter) ||
        String(request.status).includes(lowerFilter)
      );
    });
  }, [filter, sortedRequests]);

  const statusCounts = useMemo(() => {
    const counts = { past: 0, active: 0, future: 0 };
    filteredRequests.forEach((request) => {
      counts[getRequestStatus(request, currentTime, recordingStartTime)]++;
    });
    return counts;
  }, [currentTime, filteredRequests, recordingStartTime]);

  return (
    <div className="flex flex-col h-full bg-background text-foreground text-sm">
      <NetworkPanelToolbar filter={filter} onFilterChange={setFilter} statusCounts={statusCounts} />

      <Allotment className="flex-1 min-h-0">
        <Allotment.Pane preferredSize="50%" minSize={100}>
          <div className="h-full">
            {filteredRequests.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                {requests.length === 0 ? '没有录制到网络请求' : '没有匹配的请求'}
              </div>
            ) : (
              <NetworkRequestList
                requests={filteredRequests}
                currentTime={currentTime}
                recordingStartTime={recordingStartTime}
                selectedRequestId={selectedRequest?.id}
                onSelectRequest={setSelectedRequest}
              />
            )}
          </div>
        </Allotment.Pane>

        <Allotment.Pane minSize={100}>
          <div className="overflow-auto h-full">
            {selectedRequest ? (
              <NetworkRequestDetail
                request={selectedRequest}
                isFuture={
                  getRequestStatus(selectedRequest, currentTime, recordingStartTime) === 'future'
                }
              />
            ) : (
              <div className="p-4 text-center text-muted-foreground">选择一个请求查看详情</div>
            )}
          </div>
        </Allotment.Pane>
      </Allotment>
    </div>
  );
}
