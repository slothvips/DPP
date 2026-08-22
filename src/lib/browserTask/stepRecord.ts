import type { BrowserActionState, BrowserTaskState } from './types';

export interface BuildActionRecordInput {
  action: string;
  message: string;
  error?: boolean;
  stateBefore: BrowserTaskState;
  stateAfter: BrowserTaskState;
}

export function buildActionRecord(input: BuildActionRecordInput): BrowserActionState {
  const { action, message, error, stateBefore, stateAfter } = input;
  const urlChanged = stateBefore.page.url !== stateAfter.page.url;
  const tabChanged = stateBefore.currentTabId !== stateAfter.currentTabId;
  return {
    action,
    result: message,
    error: error || undefined,
    urlBefore: stateBefore.page.url,
    urlAfter: stateAfter.page.url,
    tabIdBefore: stateBefore.currentTabId,
    tabIdAfter: stateAfter.currentTabId,
    switchedToTabId: tabChanged ? stateAfter.currentTabId : undefined,
    navigatedFrom: urlChanged ? stateBefore.page.url : undefined,
    navigatedTo: urlChanged ? stateAfter.page.url : undefined,
  };
}
