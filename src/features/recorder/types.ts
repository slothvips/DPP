export interface Recording {
  id: string;
  title: string;
  url: string;
  favicon?: string;
  createdAt: number;
  duration: number;
  eventsCount: number;
  fileSize: number;
  /**
   * rrweb 事件流(实际类型为 `eventWithTime[]` from `@rrweb/types`)
   *
   * 此处保留 `unknown[]` 以兼容内容脚本消息载荷的弱类型传递
   * (recorder 内容脚本通过 runtime.sendMessage 传递 events,
   * 消息类型声明为 unknown[],强行收紧会导致消息处理链多处 as 断言)。
   * 消费方(playerShared.ts)已通过 `as unknown as RRWebEvent[]` 收紧类型。
   */
  events: unknown[];
}

/** 录像元数据(不含 events 数组,用于列表展示与 UI 交互) */
export type RecordingMeta = Omit<Recording, 'events'>;

export interface RecordingState {
  isRecording: boolean;
  startTime?: number;
  tabId?: number;
}
