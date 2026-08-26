export const PAGE_AGENT_BRIDGE_API_KEY = 'dpp-local-bridge';

export function resolvePageAgentApiKey(apiKey?: string): string {
  return apiKey?.trim() || PAGE_AGENT_BRIDGE_API_KEY;
}

export interface PageAgentConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}
