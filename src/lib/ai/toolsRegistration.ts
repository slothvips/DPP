import { registerAIConfigTools } from './tools/aiConfig';
import { registerBlackboardTools } from './tools/blackboard';
import { registerBrowserTaskTools } from './tools/browserTask';
import { registerCalculatorTools } from './tools/calculator';
import { registerDateTimeTools } from './tools/dateTime';
import { registerDeveloperUtilityTools } from './tools/developerUtilities';
import { registerDPPConfigTools } from './tools/dppConfig';
import { registerDppSearchTools } from './tools/dppSearch';
import { registerJenkinsTools } from './tools/jenkins';
import { registerLinksTools } from './tools/links';
import { registerPlanTools } from './tools/plan';
import { registerPromptTools } from './tools/prompts';
import { registerRecentActivitiesTools } from './tools/recentActivities';
import { registerRecorderTools } from './tools/recorder';
import { registerSessionTools } from './tools/session';
import { registerTagsTools } from './tools/tags';
import { registerTestCaseTools } from './tools/testCases';
import { registerTestProjectTools } from './tools/testProjects';
import { registerTestRunTools } from './tools/testRuns';
import { registerUnitConversionTools } from './tools/unitConversion';

let aiToolsRegistered = false;

export function ensureAIToolsRegistered(): void {
  if (aiToolsRegistered) {
    return;
  }

  registerAIConfigTools();
  registerDateTimeTools();
  registerCalculatorTools();
  registerUnitConversionTools();
  registerDeveloperUtilityTools();
  registerDPPConfigTools();
  registerDppSearchTools();
  registerLinksTools();
  registerTagsTools();
  registerJenkinsTools();
  registerRecorderTools();
  registerSessionTools();
  registerBlackboardTools();
  registerRecentActivitiesTools();
  registerBrowserTaskTools();
  registerPlanTools();
  registerPromptTools();
  registerTestCaseTools();
  registerTestRunTools();
  registerTestProjectTools();

  aiToolsRegistered = true;
}
