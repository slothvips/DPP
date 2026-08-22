import { useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import type { BrowserTaskStatus } from '@/lib/browserTask/types';
import { BROWSER_TASK_STORAGE_KEY } from '@/lib/browserTask/types';

export interface BrowserTaskProgress {
  taskId: string;
  sessionId?: string;
  task: string;
  status: BrowserTaskStatus;
  activity: unknown;
  history: unknown[];
  result?: string;
  modelOutput?: string;
  error?: string;
  initialTabId?: number;
  updatedAt: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isTaskStatus(value: unknown): value is BrowserTaskStatus {
  return (
    value === 'running' ||
    value === 'waiting_user' ||
    value === 'completed' ||
    value === 'failed' ||
    value === 'stopped'
  );
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  return typeof record[key] === 'string' ? record[key] : undefined;
}

function readTaskProgress(message: unknown): BrowserTaskProgress | null {
  if (!isRecord(message) || message.type !== 'BROWSER_TASK_EVENT') return null;
  if (typeof message.taskId !== 'string' || !isRecord(message.event)) return null;

  const event = message.event;
  const status = event.status;
  if (!isTaskStatus(status)) return null;

  const history = Array.isArray(event.history) ? event.history : [];
  return {
    taskId: message.taskId,
    sessionId: readString(event, 'sessionId'),
    task: readString(event, 'task') || '网页任务',
    status,
    history,
    result: readString(event, 'result'),
    modelOutput: readString(event, 'modelOutput'),
    activity: event.activity,
    error: readString(event, 'error'),
    initialTabId: typeof event.initialTabId === 'number' ? event.initialTabId : undefined,
    updatedAt: typeof event.updatedAt === 'number' ? event.updatedAt : Date.now(),
  };
}

export function useBrowserTaskProgress(sessionId: string | null): BrowserTaskProgress | null {
  const [progressBySession, setProgressBySession] = useState<Record<string, BrowserTaskProgress>>(
    {}
  );
  const currentSessionIdRef = useRef(sessionId);
  const taskSessionIdsRef = useRef<Record<string, string>>({});

  currentSessionIdRef.current = sessionId;

  useEffect(() => {
    const storeProgress = (nextProgress: BrowserTaskProgress) => {
      const taskSessionId =
        nextProgress.sessionId ||
        taskSessionIdsRef.current[nextProgress.taskId] ||
        currentSessionIdRef.current;
      if (!taskSessionId) return;

      taskSessionIdsRef.current[nextProgress.taskId] = taskSessionId;
      setProgressBySession((previous) => {
        const current = previous[taskSessionId];
        if (current && current.updatedAt > nextProgress.updatedAt) {
          return previous;
        }
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
      .get(BROWSER_TASK_STORAGE_KEY)
      .then((stored) => {
        const message = stored[BROWSER_TASK_STORAGE_KEY];
        if (!isRecord(message) || typeof message.taskId !== 'string') return;
        const nextProgress = readTaskProgress({
          type: 'BROWSER_TASK_EVENT',
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
