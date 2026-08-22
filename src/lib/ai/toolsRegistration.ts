import { registerAIConfigTools } from './tools/aiConfig';
import { registerBlackboardTools } from './tools/blackboard';
import { registerDPPConfigTools } from './tools/dppConfig';
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

  registerAIConfigTools();
  registerDPPConfigTools();
  registerLinksTools();
  registerTagsTools();
  registerJenkinsTools();
  registerRecorderTools();
  registerBlackboardTools();
  registerRecentActivitiesTools();
  registerPageAgentTools();

  aiToolsRegistered = true;
}
