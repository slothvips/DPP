// Register all AI tools
import { registerBlackboardTools } from './tools/blackboard';
import { registerHotNewsTools } from './tools/hotnews';
import { registerJenkinsTools } from './tools/jenkins';
import { registerLinksTools } from './tools/links';
import { registerRecorderTools } from './tools/recorder';
import { registerTagsTools } from './tools/tags';

// AI library exports

export * from './types';
export * from './ollama';
export * from './tools';
export * from './prompt';
export * from './tools/links';
export * from './tools/tags';
export * from './tools/hotnews';
export * from './tools/jenkins';
export * from './tools/recorder';
export * from './tools/blackboard';

registerLinksTools();
registerTagsTools();
registerHotNewsTools();
registerJenkinsTools();
registerRecorderTools();
registerBlackboardTools();
