import { trackEvent } from './tracker';
import type { TrackOpts } from './types';

/**
 * 中央事件注册表：所有埋点的唯一口径来源。
 * 新增埋点必须先在此注册动作枚举，再于业务代码中调用对应 helper。
 * 只允许预定义枚举值，禁止携带 URL、标题、对话内容等用户数据。
 */

export const FRAME_EVENTS = {
  featureOpened: 'feature_opened',
  featureClosed: 'feature_closed',
  featureHeartbeat: 'feature_heartbeat',
} as const;

export const LINKS_EVENTS = {
  linkOpened: 'link_opened',
  linkCreated: 'link_created',
  linkDeleted: 'link_deleted',
  categoryCreated: 'category_created',
  importFinished: 'import_finished',
  exportFinished: 'export_finished',
} as const;

export const JENKINS_EVENTS = {
  serverAdded: 'server_added',
  serverTested: 'server_tested',
  jobTriggered: 'job_triggered',
  jobCancelled: 'job_cancelled',
  buildViewed: 'build_viewed',
  paramFormOpened: 'param_form_opened',
} as const;

export const AI_ASSISTANT_EVENTS = {
  sessionCreated: 'session_created',
  messageSent: 'message_sent',
  messageFailed: 'message_failed',
  toolCall: 'tool_call',
  modelChanged: 'model_changed',
  configSaved: 'config_saved',
  dialogOpened: 'dialog_opened',
} as const;

export const RECORDER_EVENTS = {
  recordingStarted: 'recording_started',
  recordingStopped: 'recording_stopped',
  replayOpened: 'replay_opened',
  exportFinished: 'export_finished',
} as const;

export const BLACKBOARD_EVENTS = {
  noteCreated: 'note_created',
  noteUpdated: 'note_updated',
  noteDeleted: 'note_deleted',
  boardOpened: 'board_opened',
} as const;

export const HOTNEWS_EVENTS = {
  feedRefreshed: 'feed_refreshed',
  articleOpened: 'article_opened',
  filterChanged: 'filter_changed',
} as const;

export const TOTP_EVENTS = {
  accountAdded: 'account_added',
  codeCopied: 'code_copied',
  codeRevealed: 'code_revealed',
} as const;

export const PLAYGROUND_EVENTS = {
  toolOpened: 'tool_opened',
  toolUsed: 'tool_used',
} as const;

export const SETTINGS_EVENTS = {
  pageOpened: 'page_opened',
  syncEnabled: 'sync_enabled',
  syncDisabled: 'sync_disabled',
  dataExported: 'data_exported',
  dataCleared: 'data_cleared',
  featureFlagChanged: 'feature_flag_changed',
} as const;

export const SYNC_EVENTS = {
  pushFinished: 'push_finished',
  pullFinished: 'pull_finished',
  conflictResolved: 'conflict_resolved',
} as const;

export const ERROR_EVENTS = {
  unexpectedError: 'unexpected_error',
} as const;

type EventMap = Record<string, string>;

function createTracker<M extends EventMap>(module: string, events: M) {
  return function track(action: keyof M, opts?: TrackOpts): void {
    const resolved = events[action];
    if (typeof resolved !== 'string') return;
    trackEvent({ module, action: resolved, value: opts?.value, meta: opts?.meta });
  };
}

export const trackFrame = createTracker('frame', FRAME_EVENTS);

/** sidepanel TabId → 埋点 module，必须与各 createTracker 的 module 对齐 */
const FEATURE_MODULE_IDS: Record<string, string> = {
  hotNews: 'hotnews',
};

export function trackFeaturePresence(
  module: string,
  presence: keyof typeof FRAME_EVENTS,
  opts?: TrackOpts
): void {
  const action = FRAME_EVENTS[presence];
  if (typeof action !== 'string') return;
  const resolvedModule = FEATURE_MODULE_IDS[module] ?? module;
  trackEvent({ module: resolvedModule, action, value: opts?.value });
}

export const trackLinks = createTracker('links', LINKS_EVENTS);
export const trackJenkins = createTracker('jenkins', JENKINS_EVENTS);
export const trackAiAssistant = createTracker('aiAssistant', AI_ASSISTANT_EVENTS);
export const trackRecorder = createTracker('recorder', RECORDER_EVENTS);
export const trackBlackboard = createTracker('blackboard', BLACKBOARD_EVENTS);
export const trackHotnews = createTracker('hotnews', HOTNEWS_EVENTS);
export const trackTotp = createTracker('totp', TOTP_EVENTS);
export const trackPlayground = createTracker('playground', PLAYGROUND_EVENTS);
export const trackSettings = createTracker('settings', SETTINGS_EVENTS);
export const trackSync = createTracker('sync', SYNC_EVENTS);
export const trackError = createTracker('error', ERROR_EVENTS);
