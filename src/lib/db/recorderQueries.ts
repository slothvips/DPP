import { db } from '@/db';
import type { Recording, RecordingMeta } from '@/features/recorder/types';

export type { RecordingMeta };

/**
 * 获取所有录像的完整数据(含 events 数组)
 *
 * 注意:events 数组单条可达数 MB,大量录像时内存开销大。
 * 列表展示请优先使用 `getAllRecordingMetas()`。
 * 仅在确实需要 events(如同步、导出)时使用本函数。
 */
export async function getAllRecordings(): Promise<Recording[]> {
  return db.recordings.orderBy('createdAt').reverse().toArray();
}

/**
 * 获取所有录像的元数据(不含 events 数组)
 *
 * 性能优化:虽然 Dexie 仍会读取完整记录,但本函数在返回前
 * 剥离 events 数组,使 UI 层 React state 不长期持有大量事件数据,
 * 让 events 数组可被 GC 回收,显著降低列表页的长期内存占用。
 *
 * 真正彻底的优化需要将 events 拆到独立表(需 schema 迁移),
 * 为兼容现有数据暂不拆表。
 */
export async function getAllRecordingMetas(): Promise<RecordingMeta[]> {
  const recordings = await db.recordings.orderBy('createdAt').reverse().toArray();
  return recordings.map(({ events: _events, ...meta }) => meta);
}

export async function getRecordingById(id: string): Promise<Recording | undefined> {
  return db.recordings.get(id);
}
