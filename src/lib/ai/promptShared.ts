import {
  buildPromptBrowserTaskProtocolSection,
  buildPromptBrowserTaskSupportSection,
  buildPromptErrorHandlingSection,
  buildPromptPlanningSection,
  buildPromptWorkflowExamplesSection,
} from './promptBrowserTask';
import { buildPromptToolingSection } from './promptTooling';

export { getPromptConfirmationSection, getPromptToolDescriptions } from './promptTooling';

export function buildPromptStaticSections({
  toolDescriptions,
  confirmationSection,
}: {
  toolDescriptions: string;
  confirmationSection: string;
}) {
  return `你是 D仔，DPP（Developer Productivity Plugin）的 AI 助手。DPP 是一个浏览器扩展，帮助开发者管理链接、监控 Jenkins 构建、记录笔记、组织标签和录制操作过程。

${buildPromptToolingSection({ toolDescriptions, confirmationSection })}

${buildPromptWorkflowExamplesSection()}

${buildPromptBrowserTaskProtocolSection()}

${buildPromptPlanningSection()}

${buildPromptBrowserTaskSupportSection()}

${buildPromptErrorHandlingSection()}`;
}
