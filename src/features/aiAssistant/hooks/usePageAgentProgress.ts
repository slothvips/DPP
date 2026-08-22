import { useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import type { PageAgentTaskStatus } from '@/lib/pageAgent/multiPageTypes';
import { PAGE_AGENT_TASK_STORAGE_KEY } from '@/lib/pageAgent/multiPageTypes';

export interface PageAgentProgress {
  taskId: string;
  sessionId?: string;
  task: string;
  status: PageAgentTaskStatus;
  activity: unknown;
  history: unknown[];
  result?: { success: boolean; data: string };
  error?: string;
  updatedAt: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isTaskStatus(value: unknown): value is PageAgentTaskStatus {
  return (
    value === 'queued' ||
    value === 'running' ||
    value === 'stopping' ||
    value === 'completed' ||
    value === 'failed' ||
    value === 'stopped'
  );
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  return typeof record[key] === 'string' ? record[key] : undefined;
}

function readTaskProgress(message: unknown): PageAgentProgress | null {
  if (!isRecord(message) || message.type !== 'PAGE_AGENT_TASK_EVENT') return null;
  if (typeof message.taskId !== 'string' || !isRecord(message.event)) return null;

  const event = message.event;
  const status = event.status;
  if (!isTaskStatus(status)) return null;

  const history = Array.isArray(event.history) ? event.history : [];
  const result = isRecord(event.result)
    ? {
        success: event.result.success === true,
        data: readString(event.result, 'data') || '',
      }
    : undefined;

  return {
    taskId: message.taskId,
    sessionId: readString(event, 'sessionId'),
    task: readString(event, 'task') || '网页任务',
    status,
    activity: event.activity,
    history,
    result,
    error: readString(event, 'error'),
    updatedAt: typeof event.updatedAt === 'number' ? event.updatedAt : Date.now(),
  };
}

export function usePageAgentProgress(sessionId: string | null): PageAgentProgress | null {
  const [progressBySession, setProgressBySession] = useState<Record<string, PageAgentProgress>>({});
  const currentSessionIdRef = useRef(sessionId);
  const taskSessionIdsRef = useRef<Record<string, string>>({});

  currentSessionIdRef.current = sessionId;

  useEffect(() => {
    const storeProgress = (nextProgress: PageAgentProgress) => {
      const taskSessionId =
        nextProgress.sessionId ||
        taskSessionIdsRef.current[nextProgress.taskId] ||
        currentSessionIdRef.current;
      if (!taskSessionId) return;

      taskSessionIdsRef.current[nextProgress.taskId] = taskSessionId;
      setProgressBySession((previous) => {
        const next = { ...previous, [taskSessionId]: nextProgress };
        const entries = Object.entries(next).sort(
          ([, left], [, right]) => left.updatedAt - right.updatedAt
        );
        while (entries.length > 32) {
          const [oldestSessionId] = entries.shift() || [];
          if (oldestSessionId && oldestSessionId !== currentSessionIdRef.current) {
            delete next[oldestSessionId];
          }
        }
        return next;
      });

      if (
        nextProgress.status === 'completed' ||
        nextProgress.status === 'failed' ||
        nextProgress.status === 'stopped'
      ) {
        delete taskSessionIdsRef.current[nextProgress.taskId];
      }
    };

    const handleMessage = (message: unknown) => {
      const nextProgress = readTaskProgress(message);
      if (!nextProgress) return;
      storeProgress(nextProgress);
    };

    browser.runtime.onMessage.addListener(handleMessage);
    void browser.storage.session
      .get(PAGE_AGENT_TASK_STORAGE_KEY)
      .then((stored) => {
        const message = stored[PAGE_AGENT_TASK_STORAGE_KEY];
        if (!isRecord(message) || typeof message.taskId !== 'string') return;
        const nextProgress = readTaskProgress({
          type: 'PAGE_AGENT_TASK_EVENT',
          taskId: message.taskId,
          event: message,
        });
        if (nextProgress) storeProgress(nextProgress);
      })
      .catch(() => undefined);
    return () => browser.runtime.onMessage.removeListener(handleMessage);
  }, []);

  return sessionId ? progressBySession[sessionId] || null : null;
}
