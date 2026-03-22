// Register all AI tools
import { registerAgentTools } from './tools/agent';
import { registerBlackboardTools } from './tools/blackboard';
import { registerBrowserTools } from './tools/browser';
import { registerHotNewsTools } from './tools/hotnews';
import { registerJenkinsTools } from './tools/jenkins';
import { registerLinksTools } from './tools/links';
import { registerPageAgentTools } from './tools/pageAgent';
import { registerRecentActivitiesTools } from './tools/recentActivities';
import { registerRecorderTools } from './tools/recorder';
import { registerTagsTools } from './tools/tags';

// AI library exports

export * from './types';
export * from './ollama';
export * from './webllm';
export * from './tools';
export * from './prompt';
export * from './tools/links';
export * from './tools/tags';
export * from './tools/hotnews';
export * from './tools/jenkins';
export * from './tools/recorder';
export * from './tools/blackboard';
export * from './tools/recentActivities';
export * from './tools/pageAgent';
export * from './tools/agent';

registerBrowserTools();
registerLinksTools();
registerTagsTools();
registerHotNewsTools();
registerJenkinsTools();
registerRecorderTools();
registerBlackboardTools();
registerRecentActivitiesTools();
registerPageAgentTools();
registerAgentTools();
