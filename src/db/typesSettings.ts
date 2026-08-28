import type { AIProviderType } from '@/lib/ai/types';
import type { GlobalSyncPhase, GlobalSyncStatus } from '@/lib/sync/types';
import type { JenkinsEnvironment } from './typesDomain';

export interface StoredEncryptedValue {
  ciphertext: string;
  iv: string;
}

type AIProviderSettingMap = {
  [Provider in AIProviderType as `ai_${Provider}_base_url`]: string;
} & {
  [Provider in AIProviderType as `ai_${Provider}_model`]: string;
} & {
  [Provider in AIProviderType as `ai_${Provider}_api_key`]: string | StoredEncryptedValue;
};

interface BaseSettingMap {
  theme: 'light' | 'dark' | 'system';
  last_sync_time: number;
  last_sync_status: string;
  global_sync_status: GlobalSyncStatus;
  global_sync_phase: GlobalSyncPhase;
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
  /**
   * 个人私钥：仅用于个人私密数据加密/同步，禁止与他人分享。
   * 与 sync_encryption_key（团队同步密钥）相互独立。
   */
  personal_encryption_key: string;
  /** 是否已完成个人同步表的首次 enqueue（升级/已有私钥场景） */
  personal_sync_bootstrap_done: boolean;
  feature_hotnews_enabled: boolean;
  feature_links_enabled: boolean;
  feature_blackboard_enabled: boolean;
  feature_jenkins_enabled: boolean;
  feature_recorder_enabled: boolean;
  feature_ai_assistant_enabled: boolean;
  feature_playground_enabled: boolean;
  feature_totp_enabled: boolean;
  sync_client_id: string;
  global_sync_start_time: number;
  show_others_builds: boolean;
  jenkins_builds_last_refresh_by_env: Record<string, number>;
  jenkins_jobs_last_refresh_by_env: Record<string, number>;
  auto_sync_enabled: boolean;
  auto_sync_interval: number;
  ai_provider_type: AIProviderType;
  ai_active_profile_id: string;
  ai_base_url: string;
  ai_model: string;
  ai_api_key: string | StoredEncryptedValue;
  ai_opencode_vision_enabled: boolean;
  links_sort_by: 'createdAt' | 'updatedAt' | 'usageCount' | 'lastUsedAt';
  /** 验证器 PIN 哈希（Base64，PBKDF2）；空字符串表示未设置 */
  totp_pin_hash: string;
  /** 验证器 PIN 盐（Base64） */
  totp_pin_salt: string;
  /** PBKDF2 迭代次数 */
  totp_pin_iterations: number;
  /**
   * 验证器自动锁屏分钟数。
   * 0 表示仅在离开验证器/隐藏扩展时锁定；>0 时另加空闲超时。
   */
  totp_pin_auto_lock_minutes: number;
}

export type SettingMap = BaseSettingMap & AIProviderSettingMap;

export type SettingKey = keyof SettingMap;
export type SettingValue<K extends SettingKey> = SettingMap[K];

export interface Setting<K extends SettingKey = SettingKey> {
  key: K;
  value: SettingValue<K>;
}
