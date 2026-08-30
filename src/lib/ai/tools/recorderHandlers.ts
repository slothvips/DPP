import {
  clearRecordings,
  deleteRecording,
  exportRecordingAsJson,
  importRecordingFromJson,
  updateRecordingTitle,
} from '@/lib/db';
import { resolveRecorderTabId, sendRecorderMessage } from './recorderShared';

export async function recorder_list(args: { page?: number; pageSize?: number }) {
  const page = Number.isInteger(args.page) && (args.page ?? 0) > 0 ? args.page! : 1;
  const pageSize = Math.min(
    Number.isInteger(args.pageSize) && (args.pageSize ?? 0) > 0 ? args.pageSize! : 20,
    100
  );
  const recordings = await sendRecorderMessage<{
    items: Array<{
      id: string;
      title: string;
      url: string;
      favicon?: string;
      createdAt: number;
      duration: number;
      eventsCount: number;
      fileSize: number;
    }>;
    total: number;
  }>({ type: 'RECORDER_GET_ALL_RECORDINGS', offset: (page - 1) * pageSize, limit: pageSize });

  return {
    total: recordings.total,
    page,
    pageSize,
    hasMore: page * pageSize < recordings.total,
    recordings: recordings.items.map((recording) => ({
      id: recording.id,
      title: recording.title,
      url: recording.url,
      favicon: recording.favicon,
      createdAt: recording.createdAt,
      duration: recording.duration,
      eventsCount: recording.eventsCount,
      fileSize: recording.fileSize,
    })),
  };
}

export async function recorder_start(args: { tabId?: number }) {
  const targetTabId = await resolveRecorderTabId(args.tabId);
  await sendRecorderMessage({ type: 'RECORDER_START', tabId: targetTabId });

  return {
    success: true,
    message: `Recording started on tab ${targetTabId}`,
    tabId: targetTabId,
  };
}

export async function recorder_stop(args: { tabId?: number }) {
  const targetTabId = await resolveRecorderTabId(args.tabId);
  await sendRecorderMessage({ type: 'RECORDER_STOP', tabId: targetTabId });

  return {
    success: true,
    message: `Recording stopped on tab ${targetTabId}`,
    tabId: targetTabId,
  };
}

export async function recorder_delete(args: { id: string }) {
  return deleteRecording({ id: args.id });
}

export async function recorder_clear() {
  return clearRecordings();
}

export async function recorder_updateTitle(args: { id: string; title: string }) {
  return updateRecordingTitle({ id: args.id, title: args.title });
}

export async function recorder_import(args: { events: unknown[]; title?: string }) {
  return importRecordingFromJson({ events: args.events, title: args.title });
}

export async function recorder_export(args: { id: string }) {
  return exportRecordingAsJson({ id: args.id });
}
