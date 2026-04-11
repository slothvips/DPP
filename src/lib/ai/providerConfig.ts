import { DEFAULT_OLLAMA_BASE_URL, DEFAULT_OLLAMA_MODEL } from './ollama';

export const DEFAULT_CONFIGS = {
  ollama: {
    baseUrl: DEFAULT_OLLAMA_BASE_URL,
    model: DEFAULT_OLLAMA_MODEL,
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-3-haiku-20240307',
  },
  custom: {
    baseUrl: '',
    model: '',
  },
} as const;
