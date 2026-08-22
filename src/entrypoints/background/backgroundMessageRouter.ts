import {
  handleBrowserTaskMessage,
  handleBrowserTaskRemoteMessage,
  handleGeneralMessage,
  handleJenkinsMessage,
  handleProxyMessage,
  handleRecorderMessage,
  handleRemoteRecordingMessage,
  handleSyncMessage,
} from './handlers';

type RuntimeMessage = {
  type: string;
  payload?: unknown;
};

type MessageHandler = (message: RuntimeMessage, sender?: unknown) => unknown;

const messageHandlers: Array<{
  match: (type: string) => boolean;
  handler: MessageHandler;
}> = [
  {
    match: (type) => type.startsWith('JENKINS_'),
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
    match: (type) => type === 'ZEN_FETCH_JSON' || type === 'JENKINS_API_REQUEST',
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
      type === 'BROWSER_TASK_SUBSCRIBE',
    handler: (message) =>
      handleBrowserTaskMessage(message as Parameters<typeof handleBrowserTaskMessage>[0]),
  },
  {
    match: (type) => type === 'BROWSER_CONTROL',
    handler: (message) =>
      handleBrowserTaskRemoteMessage(
        message as Parameters<typeof handleBrowserTaskRemoteMessage>[0]
      ),
  },
  {
    match: (type) =>
      type === 'OPEN_SIDE_PANEL' || type === 'SAVE_JENKINS_TOKEN' || type === 'CAPTURE_VISIBLE_TAB',
    handler: (message) =>
      handleGeneralMessage(message as Parameters<typeof handleGeneralMessage>[0]),
  },
];

export function routeBackgroundMessage(message: RuntimeMessage, sender?: unknown): unknown {
  const messageType = message.type;

  for (const { match, handler } of messageHandlers) {
    if (match(messageType)) {
      return handler(message, sender);
    }
  }

  return false;
}
