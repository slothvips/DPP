import { useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import type { ChatMessage as AgentChatMessage } from '@/lib/ai/types';
import type { BrowserTaskStatus } from '@/lib/browserTask/types';
import { listBrowserTaskRecords } from '@/lib/db/browserTasks';

export interface BrowserTaskProgress {
  taskId: string;
  sessionId?: string;
  toolCallId?: string;
  task: string;
  status: BrowserTaskStatus;
  result?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
  stopSource?: 'chat' | 'browser' | 'system';
}

export interface BrowserTaskDetail extends BrowserTaskProgress {
  conversation: AgentChatMessage[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isTaskStatus(value: unknown): value is BrowserTaskStatus {
  return (
    value === 'queued' ||
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

  return {
    taskId: message.taskId,
    sessionId: readString(event, 'sessionId'),
    toolCallId: readString(event, 'toolCallId'),
    task: readString(event, 'task') || '网页任务',
    status,
    result: readString(event, 'result'),
    error: readString(event, 'error'),
    createdAt:
      typeof event.createdAt === 'number'
        ? event.createdAt
        : typeof event.updatedAt === 'number'
          ? event.updatedAt
          : Date.now(),
    updatedAt: typeof event.updatedAt === 'number' ? event.updatedAt : Date.now(),
    stopSource:
      event.stopSource === 'chat' || event.stopSource === 'browser' || event.stopSource === 'system'
        ? event.stopSource
        : undefined,
  };
}

function readTaskDetail(value: unknown): BrowserTaskDetail | null {
  if (!isRecord(value) || typeof value.taskId !== 'string') return null;
  const status = value.status;
  if (!isTaskStatus(status)) return null;
  const conversation = Array.isArray(value.conversation)
    ? (value.conversation.filter(isRecord) as unknown as AgentChatMessage[])
    : [];
  return {
    taskId: value.taskId,
    sessionId: readString(value, 'sessionId'),
    toolCallId: readString(value, 'toolCallId'),
    task: readString(value, 'task') || '网页任务',
    status,
    conversation,
    result: readString(value, 'result'),
    error: readString(value, 'error'),
    createdAt:
      typeof value.createdAt === 'number'
        ? value.createdAt
        : typeof value.updatedAt === 'number'
          ? value.updatedAt
          : Date.now(),
    updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : Date.now(),
  };
}

export async function getBrowserTaskDetail(taskId: string): Promise<BrowserTaskDetail | null> {
  try {
    const response = await browser.runtime.sendMessage({
      type: 'BROWSER_TASK_GET_DETAIL',
      taskId,
    });
    return readTaskDetail(response);
  } catch {
    return null;
  }
}

export async function resumeBrowserTask(taskId: string): Promise<boolean> {
  try {
    const response = await browser.runtime.sendMessage({
      type: 'BROWSER_TASK_RESUME',
      taskId,
    });
    return isRecord(response) && response.success === true;
  } catch {
    return false;
  }
}

export function useBrowserTaskProgress(sessionId: string | null): BrowserTaskProgress[] {
  const [progressByTask, setProgressByTask] = useState<Record<string, BrowserTaskProgress>>({});
  const currentSessionIdRef = useRef(sessionId);

  currentSessionIdRef.current = sessionId;

  useEffect(() => {
    const storeProgress = (nextProgress: BrowserTaskProgress) => {
      const taskSessionId = nextProgress.sessionId || currentSessionIdRef.current;
      if (!taskSessionId) return;

      const progress = { ...nextProgress, sessionId: taskSessionId };
      setProgressByTask((previous) => {
        const current = previous[progress.taskId];
        if (current && current.updatedAt > progress.updatedAt) {
          return previous;
        }
        const next = { ...previous, [progress.taskId]: progress };
        return next;
      });
    };

    const handleMessage = (message: unknown) => {
      const nextProgress = readTaskProgress(message);
      if (!nextProgress) return;
      storeProgress(nextProgress);
    };

    browser.runtime.onMessage.addListener(handleMessage);
    void listBrowserTaskRecords(sessionId || undefined)
      .then((records) => {
        for (const record of records) {
          const nextProgress = readTaskProgress({
            type: 'BROWSER_TASK_EVENT',
            taskId: record.taskId,
            event: record.summary,
          });
          if (nextProgress) storeProgress(nextProgress);
        }
      })
      .catch(() => undefined);
    return () => browser.runtime.onMessage.removeListener(handleMessage);
  }, [sessionId]);

  return sessionId
    ? Object.values(progressByTask)
        .filter((progress) => progress.sessionId === sessionId)
        .sort((left, right) => left.createdAt - right.createdAt)
    : [];
}
