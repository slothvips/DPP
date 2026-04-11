import { useMemo, useState } from 'react';
import { VirtualList } from '@/components/ui/virtual-list';
import { ConsoleLogItem } from '@/features/recorder/components/ConsoleLogItem';
import { ConsolePanelToolbar } from '@/features/recorder/components/ConsolePanelToolbar';
import {
  type ConsolePanelProps,
  type LogLevel,
  formatTimePoint,
  getLogStatus,
  getRecordingStartTime,
} from '@/features/recorder/components/consolePanelShared';
import { extractConsoleLogs, formatClonedValue } from '@/lib/rrweb-plugins';

export function ConsolePanel({ events, currentTime }: ConsolePanelProps) {
  const [filter, setFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState<Set<LogLevel>>(new Set());

  const logs = extractConsoleLogs(events);
  const recordingStartTime = useMemo(() => getRecordingStartTime(events), [events]);

  const sortedLogs = useMemo(
    () => [...logs].sort((left, right) => left.eventTimestamp - right.eventTimestamp),
    [logs]
  );

  const filteredLogs = useMemo(() => {
    return sortedLogs.filter((log) => {
      if (levelFilter.size > 0 && !levelFilter.has(log.level)) {
        return false;
      }
      if (!filter) {
        return true;
      }

      const lowerFilter = filter.toLowerCase();
      const content = log.args
        .map((arg) => formatClonedValue(arg))
        .join(' ')
        .toLowerCase();

      return content.includes(lowerFilter) || log.level.includes(lowerFilter);
    });
  }, [filter, levelFilter, sortedLogs]);

  const statusCounts = useMemo(() => {
    const counts = { past: 0, active: 0, future: 0 };
    filteredLogs.forEach((log) => {
      counts[getLogStatus(log, currentTime, recordingStartTime)]++;
    });
    return counts;
  }, [currentTime, filteredLogs, recordingStartTime]);

  const levelCounts = useMemo(() => {
    return sortedLogs.reduce(
      (counts, log) => {
        counts[log.level]++;
        return counts;
      },
      {
        log: 0,
        info: 0,
        warn: 0,
        error: 0,
        debug: 0,
        trace: 0,
      }
    );
  }, [sortedLogs]);

  function toggleLevelFilter(level: LogLevel) {
    setLevelFilter((previous) => {
      const next = new Set(previous);
      if (next.has(level)) {
        next.delete(level);
      } else {
        next.add(level);
      }
      return next;
    });
  }

  return (
    <div className="flex flex-col h-full bg-background text-foreground text-sm">
      <ConsolePanelToolbar
        filter={filter}
        onFilterChange={setFilter}
        statusCounts={statusCounts}
        levelFilter={levelFilter}
        levelCounts={levelCounts}
        onToggleLevel={toggleLevelFilter}
        onClearLevels={() => setLevelFilter(new Set())}
      />

      <VirtualList
        items={filteredLogs}
        estimateSize={60}
        overscan={10}
        containerClassName="flex-1"
        itemClassName="divide-y divide-border/50"
        renderItem={(log) => (
          <ConsoleLogItem
            key={log.id}
            log={log}
            status={getLogStatus(log, currentTime, recordingStartTime)}
            timeLabel={formatTimePoint(log.eventTimestamp, recordingStartTime)}
          />
        )}
      />

      {filteredLogs.length === 0 && (
        <div className="p-4 text-center text-muted-foreground">
          {logs.length === 0 ? '没有录制到控制台日志' : '没有匹配的日志'}
        </div>
      )}
    </div>
  );
}
