export async function sendRecorderMessage<T>(message: {
  type: string;
  [key: string]: unknown;
}): Promise<T> {
  const response = (await browser.runtime.sendMessage(message)) as {
    success: boolean;
    data?: T;
    error?: string;
  };

  if (!response || !response.success) {
    throw new Error(response?.error || 'Failed to communicate with recorder service');
  }

  return response.data as T;
}

export async function resolveRecorderTabId(tabId?: number): Promise<number> {
  if (tabId) {
    return tabId;
  }

  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  if (tabs.length === 0 || !tabs[0].id) {
    throw new Error('No active tab found. Please specify tabId or open a tab.');
  }

  return tabs[0].id;
}
