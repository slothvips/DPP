import {
  handleGeneralMessage,
  handleJenkinsMessage,
  handlePageAgentCloseAll,
  handlePageAgentExecute,
  handlePageAgentExecuteTaskWithTab,
  handlePageAgentInject,
  handlePageAgentInjectWithTab,
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
    handler: (message) => handleProxyMessage(message as Parameters<typeof handleProxyMessage>[0]),
  },
  {
    match: (type) => type === 'PAGE_AGENT_INJECT',
    handler: (message) =>
      handlePageAgentInject(message as Parameters<typeof handlePageAgentInject>[0]),
  },
  {
    match: (type) => type === 'PAGE_AGENT_INJECT_WITH_TAB',
    handler: (message) =>
      handlePageAgentInjectWithTab(message as Parameters<typeof handlePageAgentInjectWithTab>[0]),
  },
  {
    match: (type) => type === 'PAGE_AGENT_EXECUTE_TASK',
    handler: (message) =>
      handlePageAgentExecute(message as Parameters<typeof handlePageAgentExecute>[0]),
  },
  {
    match: (type) => type === 'PAGE_AGENT_EXECUTE_TASK_WITH_TAB',
    handler: (message) =>
      handlePageAgentExecuteTaskWithTab(
        message as Parameters<typeof handlePageAgentExecuteTaskWithTab>[0]
      ),
  },
  {
    match: (type) => type === 'PAGE_AGENT_CLOSE_ALL',
    handler: () => handlePageAgentCloseAll(),
  },
  {
    match: (type) =>
      type === 'PAGE_AGENT_GET_CONFIG' ||
      type === 'PAGE_AGENT_FETCH' ||
      type === 'OPEN_SIDE_PANEL' ||
      type === 'SAVE_JENKINS_TOKEN',
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
