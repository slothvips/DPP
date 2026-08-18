import {
  handleGeneralMessage,
  handleJenkinsMessage,
  handlePageAgentLlmAbort,
  handlePageAgentLlmRequest,
  handlePageAgentRemoteMessage,
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
    match: (type) => type === 'PAGE_AGENT_PAGE_CONTROL' || type === 'PAGE_AGENT_TAB_CONTROL',
    handler: (message) =>
      handlePageAgentRemoteMessage(message as Parameters<typeof handlePageAgentRemoteMessage>[0]),
  },
  {
    match: (type) =>
      type === 'PAGE_AGENT_GET_CONFIG' ||
      type === 'OPEN_SIDE_PANEL' ||
      type === 'SAVE_JENKINS_TOKEN' ||
      type === 'CAPTURE_VISIBLE_TAB',
    handler: (message) =>
      handleGeneralMessage(message as Parameters<typeof handleGeneralMessage>[0]),
  },
  {
    match: (type) => type === 'PAGE_AGENT_LLM_REQUEST',
    handler: (message) =>
      handlePageAgentLlmRequest(message as Parameters<typeof handlePageAgentLlmRequest>[0]),
  },
  {
    match: (type) => type === 'PAGE_AGENT_LLM_ABORT',
    handler: (message) =>
      handlePageAgentLlmAbort(message as Parameters<typeof handlePageAgentLlmAbort>[0]),
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
