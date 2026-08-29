import { registerAIConfigTools } from './tools/aiConfig';
import { registerBlackboardTools } from './tools/blackboard';
import { registerBrowserTaskTools } from './tools/browserTask';
import { registerDPPConfigTools } from './tools/dppConfig';
import { registerJenkinsTools } from './tools/jenkins';
import { registerLinksTools } from './tools/links';
import { registerPlanTools } from './tools/plan';
import { registerPromptTools } from './tools/prompts';
import { registerRecentActivitiesTools } from './tools/recentActivities';
import { registerRecorderTools } from './tools/recorder';
import { registerTagsTools } from './tools/tags';
import { registerTestCaseTools } from './tools/testCases';
import { registerTestRunTools } from './tools/testRuns';

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
  registerBrowserTaskTools();
  registerPlanTools();
  registerPromptTools();
  registerTestCaseTools();
  registerTestRunTools();

  aiToolsRegistered = true;
}
