import { registerBlackboardTools } from './tools/blackboard';
import { registerBrowserTools } from './tools/browser';
import { registerHotNewsTools } from './tools/hotnews';
import { registerJenkinsTools } from './tools/jenkins';
import { registerLinksTools } from './tools/links';
import { registerPageAgentTools } from './tools/pageAgent';
import { registerRecentActivitiesTools } from './tools/recentActivities';
import { registerRecorderTools } from './tools/recorder';
import { registerTagsTools } from './tools/tags';

let aiToolsRegistered = false;

export function ensureAIToolsRegistered(): void {
  if (aiToolsRegistered) {
    return;
  }

  registerBrowserTools();
  registerLinksTools();
  registerTagsTools();
  registerHotNewsTools();
  registerJenkinsTools();
  registerRecorderTools();
  registerBlackboardTools();
  registerRecentActivitiesTools();
  registerPageAgentTools();

  aiToolsRegistered = true;
}
