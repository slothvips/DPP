export interface AIConfigValidationInput {
  provider: 'anthropic' | 'google' | 'opencode' | 'custom';
  baseUrl: string;
  model: string;
  apiKey: string;
  profileName: string;
}

export interface AIConfigValidationErrors {
  profileName?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateAIConfig(config: AIConfigValidationInput): AIConfigValidationErrors {
  const errors: AIConfigValidationErrors = {};
  if (config.provider !== 'opencode' && !config.profileName.trim()) {
    errors.profileName = '请输入配置名称';
  }
  if (!config.baseUrl.trim()) {
    errors.baseUrl = '请输入服务地址';
  } else if (!isValidHttpUrl(config.baseUrl.trim())) {
    errors.baseUrl = '请输入以 http:// 或 https:// 开头的有效地址';
  }
  if (!config.model.trim()) {
    errors.model = '请输入模型名称';
  }
  if (config.provider !== 'opencode' && !config.apiKey.trim()) {
    errors.apiKey = '请输入 API Key';
  }
  return errors;
}
