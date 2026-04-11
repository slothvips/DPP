import type { AIProviderType } from '@/lib/ai/types';
import type { JenkinsEnvironment } from './typesDomain';

export interface StoredEncryptedValue {
  ciphertext: string;
  iv: string;
}

export interface SettingMap {
  theme: 'light' | 'dark' | 'system';
  last_sync_time: number;
  last_sync_status: string;
  global_sync_status: 'idle' | 'syncing' | 'partial' | 'error';
  global_sync_error: string;
  last_global_sync: number;
  jenkins_host: string;
  jenkins_user: string;
  jenkins_token: string;
  jenkins_environments: JenkinsEnvironment[];
  jenkins_current_env: string;
  custom_server_url: string;
  sync_access_token: string;
  sync_encryption_key: string;
  feature_hotnews_enabled: boolean;
  feature_links_enabled: boolean;
  feature_blackboard_enabled: boolean;
  feature_jenkins_enabled: boolean;
  feature_recorder_enabled: boolean;
  feature_ai_assistant_enabled: boolean;
  feature_playground_enabled: boolean;
  sync_client_id: string;
  global_sync_start_time: number;
  show_others_builds: boolean;
  auto_sync_enabled: boolean;
  auto_sync_interval: number;
  ai_provider_type: AIProviderType;
  ai_base_url: string;
  ai_model: string;
  ai_api_key: string | StoredEncryptedValue;
  ai_ollama_base_url: string;
  ai_ollama_model: string;
  ai_ollama_api_key: string | StoredEncryptedValue;
  ai_anthropic_base_url: string;
  ai_anthropic_model: string;
  ai_anthropic_api_key: string | StoredEncryptedValue;
  ai_custom_base_url: string;
  ai_custom_model: string;
  ai_custom_api_key: string | StoredEncryptedValue;
  links_sort_by: 'createdAt' | 'updatedAt' | 'usageCount' | 'lastUsedAt';
}

export type SettingKey = keyof SettingMap;
export type SettingValue<K extends SettingKey> = SettingMap[K];

export interface Setting<K extends SettingKey = SettingKey> {
  key: K;
  value: SettingValue<K>;
}
