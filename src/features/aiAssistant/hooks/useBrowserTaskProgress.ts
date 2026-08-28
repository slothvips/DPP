import { useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import type { ChatMessage as AgentChatMessage, OpenAIToolCall } from '@/lib/ai/types';
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
  stopSource?: 'chat' | 'browser' | 'system' | 'timeout';
  history: unknown[];
  activity?: unknown;
}

export interface BrowserTaskDetail extends BrowserTaskProgress {
  conversation: AgentChatMessage[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

function readHistory(record: Record<string, unknown>): unknown[] {
  return Array.isArray(record.history) ? record.history : [];
}

function readToolCalls(value: unknown): OpenAIToolCall[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const calls = value.filter((call): call is OpenAIToolCall => {
    if (!isRecord(call) || call.type !== 'function' || typeof call.id !== 'string') return false;
    if (!isRecord(call.function)) return false;
    return typeof call.function.name === 'string' && typeof call.function.arguments === 'string';
  });
  return calls.length === value.length ? calls : undefined;
}

function readConversation(value: unknown): AgentChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((message) => {
    if (!isRecord(message)) return [];
    const role = message.role;
    if (role !== 'system' && role !== 'user' && role !== 'assistant' && role !== 'tool') return [];
    if (typeof message.content !== 'string') return [];
    const toolCalls = readToolCalls(message.toolCalls);
    return [
      {
        role,
        content: message.content,
        ...(typeof message.name === 'string' ? { name: message.name } : {}),
        ...(typeof message.toolCallId === 'string' ? { toolCallId: message.toolCallId } : {}),
        ...(toolCalls ? { toolCalls } : {}),
      },
    ];
  });
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
      event.stopSource === 'chat' ||
      event.stopSource === 'browser' ||
      event.stopSource === 'system' ||
      event.stopSource === 'timeout'
        ? event.stopSource
        : undefined,
    history: readHistory(event),
    activity: event.activity,
  };
}

function readTaskDetail(value: unknown): BrowserTaskDetail | null {
  if (!isRecord(value) || typeof value.taskId !== 'string') return null;
  const status = value.status;
  if (!isTaskStatus(status)) return null;
  const conversation = readConversation(value.conversation);
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
    history: readHistory(value),
    activity: value.activity,
  };
}

export async function getBrowserTaskDetail(
  taskId: string,
  sessionId?: string
): Promise<BrowserTaskDetail | null> {
  try {
    const response = await browser.runtime.sendMessage({
      type: 'BROWSER_TASK_GET_DETAIL',
      taskId,
      sessionId,
    });
    return readTaskDetail(response);
  } catch {
    return null;
  }
}

export async function resumeBrowserTask(taskId: string, sessionId?: string): Promise<boolean> {
  try {
    const response = await browser.runtime.sendMessage({
      type: 'BROWSER_TASK_RESUME',
      taskId,
      sessionId,
    });
    return isRecord(response) && response.success === true;
  } catch {
    return false;
  }
}

export function useBrowserTaskProgress(
  sessionId: string | null,
  revision = 0,
  invalidatedTaskIds: readonly string[] = []
): BrowserTaskProgress[] {
  const [progressByTask, setProgressByTask] = useState<Record<string, BrowserTaskProgress>>({});
  const progressByTaskRef = useRef<Record<string, BrowserTaskProgress>>({});
  const invalidatedTaskIdsRef = useRef(new Set<string>());
  const currentSessionIdRef = useRef(sessionId);

  currentSessionIdRef.current = sessionId;

  useEffect(() => {
    for (const taskId of invalidatedTaskIds) invalidatedTaskIdsRef.current.add(taskId);
    progressByTaskRef.current = {};
    setProgressByTask({});
    let active = true;

    const storeProgress = (nextProgress: BrowserTaskProgress) => {
      if (!active) return;
      if (invalidatedTaskIdsRef.current.has(nextProgress.taskId)) return;
      const taskSessionId = nextProgress.sessionId || currentSessionIdRef.current;
      if (!taskSessionId) return;

      const progress = { ...nextProgress, sessionId: taskSessionId };
      setProgressByTask((previous) => {
        const current = previous[progress.taskId];
        if (current && current.updatedAt > progress.updatedAt) {
          return previous;
        }
        const next = { ...previous, [progress.taskId]: progress };
        progressByTaskRef.current = next;
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
        if (!active) return;
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
    return () => {
      active = false;
      browser.runtime.onMessage.removeListener(handleMessage);
    };
  }, [invalidatedTaskIds, revision, sessionId]);

  return sessionId
    ? Object.values(progressByTask)
        .filter((progress) => progress.sessionId === sessionId)
        .sort((left, right) => left.createdAt - right.createdAt)
    : [];
}
