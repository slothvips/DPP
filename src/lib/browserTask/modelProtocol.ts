import type { BrowserTaskState } from './types';

export function formatTaskInput(
  task: string,
  state: BrowserTaskState,
  resumeMessage?: string,
  parentContext?: string
): string {
  return `<dpp_user_request>\n${task}\n</dpp_user_request>${resumeMessage ? `\n${formatUntrusted('dpp_resume_context', resumeMessage)}` : ''}${parentContext ? `\n${formatUntrusted('dpp_parent_agent_context', parentContext)}` : ''}\n\n${formatUntrusted('dpp_browser_state', state)}`;
}

export function formatToolResult(result: Record<string, unknown>, state: BrowserTaskState): string {
  return formatUntrusted('dpp_browser_tool_result', { ...result, state });
}

function formatUntrusted(name: string, value: unknown): string {
  const json = JSON.stringify(value).replace(/</g, '\\u003c');
  return `<dpp_untrusted_content source="${name}">\n${json}\n</dpp_untrusted_content>`;
}
