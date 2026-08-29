import { browser } from 'wxt/browser';

const EXTENSION_ONLY_TYPES = new Set([
  'JENKINS_FETCH_JOBS',
  'JENKINS_FETCH_MY_BUILDS',
  'JENKINS_TRIGGER_BUILD',
  'JENKINS_GET_JOB_DETAILS',
  'JENKINS_CANCEL_BUILD',
  'RECORDER_START',
  'RECORDER_STOP',
  'RECORDER_GET_STATUS',
  'REMOTE_RECORDING_GET',
  'AUTO_SYNC_TRIGGER_PUSH',
  'AUTO_SYNC_TRIGGER_PULL',
  'GLOBAL_SYNC_START',
  'GLOBAL_SYNC_PUSH',
  'GLOBAL_SYNC_PULL',
  'OPEN_SIDE_PANEL',
  'CAPTURE_VISIBLE_TAB',
  'BROWSER_TASK_START',
  'BROWSER_TASK_STOP',
  'BROWSER_TASK_RESUME',
  'BROWSER_TASK_GET_STATUS',
  'BROWSER_TASK_GET_DETAIL',
]);

const TOP_FRAME_CONTENT_TYPES = new Set([
  'RECORDER_GET_STATUS_FOR_CONTENT',
  'RECORDER_COMPLETE',
  'SAVE_JENKINS_TOKEN',
  'JENKINS_VALIDATE_CONTENT_ORIGIN',
]);

const MIXED_TOP_FRAME_TYPES = new Set([
  'RECORDER_GET_ALL_RECORDINGS',
  'RECORDER_GET_RECORDING_BY_ID',
]);

const CONTENT_TYPES = new Set([
  'ZEN_FETCH_JSON',
  'JENKINS_API_REQUEST',
  'REMOTE_RECORDING_CACHE',
  'OPEN_PLAYER_TAB',
]);

function isExtensionContext(sender: chrome.runtime.MessageSender): boolean {
  if (sender.id !== browser.runtime.id) return false;
  if (!sender.url) return sender.tab === undefined;
  return sender.url.startsWith(browser.runtime.getURL('/'));
}

function isContentContext(sender: chrome.runtime.MessageSender, topFrameOnly: boolean): boolean {
  return (
    sender.id === browser.runtime.id &&
    sender.tab?.id !== undefined &&
    (!topFrameOnly || sender.frameId === 0)
  );
}

export function authorizeBackgroundMessage(
  type: string,
  sender: chrome.runtime.MessageSender
): string | null {
  if (sender.id !== browser.runtime.id) return '消息来源不是当前扩展';
  if (EXTENSION_ONLY_TYPES.has(type) && !isExtensionContext(sender)) {
    return '此操作仅允许扩展页面调用';
  }
  if (TOP_FRAME_CONTENT_TYPES.has(type) && !isContentContext(sender, true)) {
    return '此操作仅允许顶层页面内容脚本调用';
  }
  if (
    MIXED_TOP_FRAME_TYPES.has(type) &&
    !isExtensionContext(sender) &&
    !isContentContext(sender, true)
  ) {
    return '此操作不允许从当前上下文调用';
  }
  if (CONTENT_TYPES.has(type) && !isContentContext(sender, false)) {
    return '此操作仅允许页面内容脚本调用';
  }
  return null;
}
