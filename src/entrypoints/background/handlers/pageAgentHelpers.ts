import { injectPageAgent } from '@/lib/pageAgent/injector';
import type { PageAgentExecuteResponse, PageAgentInjectResponse } from '@/lib/pageAgent/types';
import { validateAIConfig } from './pageAgentConfig';
import { executeTaskOnTab, injectAndWaitUntilReady } from './pageAgentExecution';
import { resolveInjectableTab } from './pageAgentTab';

export async function handleInjectForTab(tabId?: number): Promise<PageAgentInjectResponse> {
  const tabResult = await resolveInjectableTab(tabId);
  if (!tabResult.success) {
    return { success: false, error: tabResult.error };
  }

  const aiConfigResult = await validateAIConfig();
  if (!aiConfigResult.success) {
    return { success: false, error: aiConfigResult.error };
  }

  return injectPageAgent(tabResult.tabId, aiConfigResult.config);
}

export async function handleExecuteForTab(
  tabId: number | undefined,
  task: string
): Promise<PageAgentExecuteResponse> {
  const tabResult = await resolveInjectableTab(tabId);
  if (!tabResult.success) {
    return { success: false, error: tabResult.error };
  }

  const aiConfigResult = await validateAIConfig();
  const injectResult = await injectAndWaitUntilReady(tabResult.tabId, aiConfigResult);
  if (!injectResult.success) {
    return { success: false, error: injectResult.error };
  }

  return executeTaskOnTab(tabResult.tabId, task);
}
