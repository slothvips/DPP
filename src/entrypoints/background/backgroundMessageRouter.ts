import {
  handleBrowserTaskMessage,
  handleGeneralMessage,
  handleJenkinsMessage,
  handleProxyMessage,
  handleRecorderMessage,
  handleRemoteRecordingMessage,
  handleSyncMessage,
} from './handlers';
import { authorizeBackgroundMessage } from './messageAuthorization';

type RuntimeMessage = {
  type: string;
  payload?: unknown;
};

type MessageHandler = (message: RuntimeMessage, sender?: chrome.runtime.MessageSender) => unknown;

const messageHandlers: Array<{
  match: (type: string) => boolean;
  handler: MessageHandler;
}> = [
  {
    match: (type) =>
      type === 'JENKINS_FETCH_JOBS' ||
      type === 'JENKINS_FETCH_MY_BUILDS' ||
      type === 'JENKINS_FETCH_ACTIVE_BUILDS' ||
      type === 'JENKINS_FETCH_QUEUE' ||
      type === 'JENKINS_FETCH_JOB_BUILDS' ||
      type === 'JENKINS_GET_BUILD_STATUS' ||
      type === 'JENKINS_TRIGGER_BUILD' ||
      type === 'JENKINS_GET_QUEUE_ITEM' ||
      type === 'JENKINS_CANCEL_QUEUE_ITEM' ||
      type === 'JENKINS_GET_JOB_DETAILS' ||
      type === 'JENKINS_GET_BUILD_DETAILS' ||
      type === 'JENKINS_GET_TEST_DETAILS' ||
      type === 'JENKINS_DOWNLOAD_ARTIFACT' ||
      type === 'JENKINS_GET_PIPELINE_STAGES' ||
      type === 'JENKINS_GET_PIPELINE_STAGE_NODES' ||
      type === 'JENKINS_GET_PIPELINE_NODE_LOG' ||
      type === 'JENKINS_SUBMIT_PIPELINE_INPUT' ||
      type === 'JENKINS_GET_BUILD_LOG' ||
      type === 'JENKINS_CANCEL_BUILD' ||
      type === 'JENKINS_STOP_BUILD',
    handler: (message) =>
      handleJenkinsMessage(message as Parameters<typeof handleJenkinsMessage>[0]),
  },
  {
    match: (type) => type.startsWith('RECORDER_'),
    handler: (message, sender) =>
      handleRecorderMessage(
        message as Parameters<typeof handleRecorderMessage>[0],
        sender as Parameters<typeof handleRecorderMessage>[1]
      ),
  },
  {
    match: (type) =>
      type === 'AUTO_SYNC_TRIGGER_PUSH' ||
      type === 'AUTO_SYNC_TRIGGER_PULL' ||
      type === 'GLOBAL_SYNC_START' ||
      type === 'GLOBAL_SYNC_PUSH' ||
      type === 'GLOBAL_SYNC_PULL',
    handler: (message) => handleSyncMessage(message as Parameters<typeof handleSyncMessage>[0]),
  },
  {
    match: (type) =>
      type === 'REMOTE_RECORDING_CACHE' ||
      type === 'REMOTE_RECORDING_GET' ||
      type === 'OPEN_PLAYER_TAB',
    handler: (message) =>
      handleRemoteRecordingMessage(message as Parameters<typeof handleRemoteRecordingMessage>[0]),
  },
  {
    match: (type) => type === 'ZEN_FETCH_JSON',
    handler: (message, sender) =>
      handleProxyMessage(
        message as Parameters<typeof handleProxyMessage>[0],
        sender as Parameters<typeof handleProxyMessage>[1] | undefined
      ),
  },
  {
    match: (type) =>
      type === 'BROWSER_TASK_START' ||
      type === 'BROWSER_TASK_STOP' ||
      type === 'BROWSER_TASK_RESUME' ||
      type === 'BROWSER_TASK_GET_STATUS' ||
      type === 'BROWSER_TASK_GET_DETAIL',
    handler: (message, sender) =>
      handleBrowserTaskMessage(
        message as Parameters<typeof handleBrowserTaskMessage>[0],
        sender as Parameters<typeof handleBrowserTaskMessage>[1]
      ),
  },
  {
    match: (type) =>
      type === 'OPEN_SIDE_PANEL' ||
      type === 'SAVE_JENKINS_TOKEN' ||
      type === 'CAPTURE_VISIBLE_TAB' ||
      type === 'JENKINS_VALIDATE_CONTENT_ORIGIN',
    handler: (message, sender) =>
      handleGeneralMessage(
        message as Parameters<typeof handleGeneralMessage>[0],
        sender as Parameters<typeof handleGeneralMessage>[1]
      ),
  },
];

export function routeBackgroundMessage(
  message: RuntimeMessage,
  sender?: chrome.runtime.MessageSender
): unknown {
  if (!message || typeof message.type !== 'string') {
    return false;
  }
  const messageType = message.type;
  if (!sender) {
    return { success: false, error: '缺少消息来源信息' };
  }
  const authorizationError = authorizeBackgroundMessage(messageType, sender);
  if (authorizationError) {
    return { success: false, error: authorizationError };
  }

  for (const { match, handler } of messageHandlers) {
    if (match(messageType)) {
      return handler(message, sender);
    }
  }

  return false;
}
