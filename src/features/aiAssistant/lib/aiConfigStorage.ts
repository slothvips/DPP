import { db } from '@/db';
import type { AIProfile, SettingKey, StoredEncryptedValue } from '@/db/types';
import { readAISetting, resolveAIApiKey } from '@/lib/ai/configShared';
import { normalizeOpenCodeModel } from '@/lib/ai/openCodeProviderShared';
import { DEFAULT_CONFIGS } from '@/lib/ai/provider';
import { AI_PROVIDER_TYPES, DEFAULT_AI_PROVIDER, isAIProviderType } from '@/lib/ai/providerIds';
import { isOpenAICompatibleProvider } from '@/lib/ai/providerRegistry';
import type { AIProviderType } from '@/lib/ai/types';
import { encryptData, generateSyncKey, loadKey, storeKey } from '@/lib/crypto/encryption';
import { updateSetting } from '@/lib/db/settings';

export interface StoredAIConfig {
  provider: AIProviderType;
  baseUrl: string;
  model: string;
  contextWindow?: number;
  apiKey: string;
}

type UserAIProvider = Exclude<AIProviderType, 'opencode'>;

export interface AIProfileSummary extends StoredAIConfig {
  id: string;
  name: string;
  updatedAt: number;
}

function createProfileId(): string {
  return `ai_profile_${crypto.randomUUID()}`;
}

function isOpenCodeProvider(provider: AIProviderType): provider is 'opencode' {
  return provider === 'opencode';
}

function normalizeProviderValue(value: unknown): AIProviderType {
  if (value === 'openai') {
    return 'custom';
  }
  return isAIProviderType(value) ? value : DEFAULT_AI_PROVIDER;
}

const LEGACY_OPENAI_COMPATIBLE_PROVIDERS = new Set(['deepseek', 'qwen', 'groq', 'openrouter']);

function legacyProvider(value: unknown): string | null {
  return typeof value === 'string' && value !== 'openai' && !isAIProviderType(value) ? value : null;
}

async function encryptApiKey(apiKey: string): Promise<string | StoredEncryptedValue> {
  if (!apiKey) {
    return '';
  }
  const encryptionKey = await loadKey();
  if (encryptionKey) {
    return encryptData(apiKey, encryptionKey);
  }

  const generatedKey = await generateSyncKey();
  await storeKey(generatedKey);
  return encryptData(apiKey, generatedKey);
}

async function readLegacyProviderConfig(provider: AIProviderType): Promise<StoredAIConfig> {
  const baseUrlKey = `ai_${provider}_base_url` as const;
  const modelKey = `ai_${provider}_model` as const;
  const apiKeyKey = `ai_${provider}_api_key` as const;
  const [savedBaseUrl, savedModel, savedApiKey] = await Promise.all([
    readAISetting(baseUrlKey),
    readAISetting(modelKey),
    readAISetting(apiKeyKey),
  ]);
  const storedModel = savedModel || DEFAULT_CONFIGS[provider].model || '';
  const model = provider === 'opencode' ? normalizeOpenCodeModel(storedModel) : storedModel;
  if (model !== storedModel) {
    await updateSetting(modelKey, model);
  }

  return {
    provider,
    baseUrl: savedBaseUrl || DEFAULT_CONFIGS[provider].baseUrl || '',
    model,
    apiKey: await resolveAIApiKey(savedApiKey, '[AIConfig]'),
  };
}

async function migrateLegacyOpenAIProfile(): Promise<AIProfile | undefined> {
  const [baseUrl, model, apiKey] = await Promise.all(
    ['ai_openai_base_url', 'ai_openai_model', 'ai_openai_api_key'].map((key) =>
      db.settings.get(key as unknown as SettingKey)
    )
  );
  const baseUrlValue = baseUrl?.value as string | undefined;
  const modelValue = model?.value as string | undefined;
  const apiKeyValue = apiKey?.value as string | StoredEncryptedValue | undefined;
  if (baseUrlValue === undefined && modelValue === undefined && apiKeyValue === undefined) {
    return undefined;
  }
  return {
    id: createProfileId(),
    name: 'openai',
    provider: 'custom',
    baseUrl: baseUrlValue || '',
    model: modelValue || '',
    contextWindow: undefined,
    apiKey: await encryptApiKey(await resolveAIApiKey(apiKeyValue, '[AIConfig]')),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

async function migrateLegacyProfiles(): Promise<void> {
  if ((await db.aiProfiles.count()) > 0) {
    return;
  }

  const activeProviderValue = (await readAISetting('ai_provider_type')) as unknown;
  const legacyActiveProvider = legacyProvider(activeProviderValue);
  if (legacyActiveProvider) {
    const [baseUrl, model, apiKey] = await Promise.all([
      readAISetting(`ai_${legacyActiveProvider}_base_url` as SettingKey),
      readAISetting(`ai_${legacyActiveProvider}_model` as SettingKey),
      readAISetting(`ai_${legacyActiveProvider}_api_key` as SettingKey),
    ]);
    if (baseUrl !== undefined || model !== undefined || apiKey !== undefined) {
      const now = Date.now();
      const profile: AIProfile = {
        id: createProfileId(),
        name: LEGACY_OPENAI_COMPATIBLE_PROVIDERS.has(legacyActiveProvider)
          ? legacyActiveProvider
          : `${legacyActiveProvider}（请确认迁移）`,
        provider: 'custom',
        baseUrl: typeof baseUrl === 'string' ? baseUrl : '',
        model: typeof model === 'string' ? model : '',
        apiKey: await encryptApiKey(await resolveAIApiKey(apiKey, '[AIConfig]')),
        createdAt: now,
        updatedAt: now,
      };
      await db.aiProfiles.add(profile);
      await updateSetting('ai_active_profile_id', profile.id);
      await updateSetting('ai_provider_type', 'custom');
      return;
    }
  }
  const providers = AI_PROVIDER_TYPES.filter(
    (provider): provider is Exclude<AIProviderType, 'opencode'> => !isOpenCodeProvider(provider)
  );
  const profiles: AIProfile[] = [];
  const profileByLegacyProvider = new Map<AIProviderType, AIProfile>();

  for (const provider of providers) {
    const [baseUrl, model, apiKey] = await Promise.all([
      readAISetting(`ai_${provider}_base_url` as const),
      readAISetting(`ai_${provider}_model` as const),
      readAISetting(`ai_${provider}_api_key` as const),
    ]);
    if (baseUrl === undefined && model === undefined && apiKey === undefined) {
      continue;
    }

    const config = await readLegacyProviderConfig(provider);
    const profileProvider = isOpenAICompatibleProvider(provider) ? 'custom' : provider;
    const now = Date.now();
    const profile: AIProfile = {
      id: createProfileId(),
      name: provider,
      provider: profileProvider,
      baseUrl: config.baseUrl,
      model: config.model,
      contextWindow: config.contextWindow,
      apiKey: await encryptApiKey(config.apiKey),
      createdAt: now,
      updatedAt: now,
    };
    profiles.push(profile);
    profileByLegacyProvider.set(provider, profile);
  }

  const legacyOpenAIProfile = await migrateLegacyOpenAIProfile();
  if (legacyOpenAIProfile) {
    profiles.push(legacyOpenAIProfile);
  }

  if (profiles.length > 0) {
    await db.aiProfiles.bulkAdd(profiles);
    const activeProfile =
      activeProviderValue === 'openai'
        ? legacyOpenAIProfile
        : isAIProviderType(activeProviderValue)
          ? profileByLegacyProvider.get(activeProviderValue)
          : undefined;
    if (activeProfile) {
      await updateSetting('ai_active_profile_id', activeProfile.id);
    }
  }
}

export async function loadAIProfiles(): Promise<AIProfileSummary[]> {
  await migrateLegacyProfiles();
  const profiles = await db.aiProfiles.orderBy('updatedAt').reverse().toArray();
  return Promise.all(
    profiles.map(async (profile) => ({
      id: profile.id,
      name: profile.name,
      provider: normalizeProviderValue(profile.provider),
      baseUrl: profile.baseUrl,
      model: profile.model,
      contextWindow: profile.contextWindow,
      apiKey: await resolveAIApiKey(profile.apiKey, '[AIConfig]'),
      updatedAt: profile.updatedAt,
    }))
  );
}

export async function loadAIConfig(): Promise<StoredAIConfig> {
  await migrateLegacyProfiles();
  const provider = normalizeProviderValue((await readAISetting('ai_provider_type')) as unknown);
  if (provider !== 'opencode') {
    const activeProfileId = await readAISetting('ai_active_profile_id');
    const profile = activeProfileId ? await db.aiProfiles.get(activeProfileId) : undefined;
    if (profile) {
      return {
        provider: normalizeProviderValue(profile.provider),
        baseUrl: profile.baseUrl,
        model: profile.model,
        contextWindow: profile.contextWindow,
        apiKey: await resolveAIApiKey(profile.apiKey, '[AIConfig]'),
      };
    }
  }
  return readLegacyProviderConfig(provider);
}

export async function loadProviderConfig(provider: AIProviderType): Promise<StoredAIConfig> {
  if (provider !== 'opencode') {
    await migrateLegacyProfiles();
    const profile = (await loadAIProfiles()).find((item) => item.provider === provider);
    if (profile) {
      return profile;
    }
  }
  return readLegacyProviderConfig(provider);
}

export async function saveAIConfig(config: StoredAIConfig): Promise<void> {
  if (config.provider === 'opencode') {
    await saveLegacyProviderConfig(config, true);
    return;
  }

  const profiles = await loadAIProfiles();
  const userConfig = { ...config, provider: config.provider as UserAIProvider };
  const existing = profiles.find(
    (profile) => profile.provider === userConfig.provider && profile.baseUrl === userConfig.baseUrl
  );
  if (existing) {
    await updateAIProfile(existing.id, { ...userConfig, name: existing.name });
  } else {
    await createAIProfile({ ...userConfig, name: userConfig.provider });
  }
}

export async function createAIProfile(
  config: Omit<StoredAIConfig, 'provider'> & { name: string; provider: UserAIProvider },
  options: { activate?: boolean } = {}
): Promise<string> {
  const now = Date.now();
  const id = createProfileId();
  await db.aiProfiles.add({
    id,
    name: config.name,
    provider: config.provider,
    baseUrl: config.baseUrl,
    model: config.model,
    contextWindow: config.contextWindow,
    apiKey: await encryptApiKey(config.apiKey),
    createdAt: now,
    updatedAt: now,
  });
  if (options.activate ?? true) {
    await updateSetting('ai_active_profile_id', id);
    await updateSetting('ai_provider_type', config.provider);
  }
  return id;
}

export async function updateAIProfile(
  id: string,
  config: Omit<StoredAIConfig, 'provider'> & { name: string; provider: UserAIProvider }
): Promise<void> {
  const existing = await db.aiProfiles.get(id);
  if (!existing) {
    throw new Error('AI profile not found');
  }
  await db.aiProfiles.update(id, {
    name: config.name,
    provider: config.provider,
    baseUrl: config.baseUrl,
    model: config.model,
    contextWindow: config.contextWindow,
    apiKey: await encryptApiKey(config.apiKey),
    updatedAt: Date.now(),
  });
}

export async function activateAIProfile(id: string): Promise<void> {
  const profile = await db.aiProfiles.get(id);
  if (!profile) {
    throw new Error('AI profile not found');
  }
  await Promise.all([
    updateSetting('ai_active_profile_id', id),
    updateSetting('ai_provider_type', profile.provider),
  ]);
}

export async function duplicateAIProfile(id: string): Promise<string> {
  const original = await db.aiProfiles.get(id);
  if (!original) {
    throw new Error('AI profile not found');
  }
  const now = Date.now();
  const newId = createProfileId();
  await db.aiProfiles.add({
    ...original,
    id: newId,
    name: `${original.name} 副本`,
    createdAt: now,
    updatedAt: now,
  });
  return newId;
}

export async function deleteAIProfile(id: string): Promise<void> {
  const activeId = await readAISetting('ai_active_profile_id');
  await db.aiProfiles.delete(id);
  if (activeId === id) {
    const next = await db.aiProfiles.orderBy('updatedAt').reverse().first();
    if (next) {
      await activateAIProfile(next.id);
    } else {
      await updateSetting('ai_provider_type', DEFAULT_AI_PROVIDER);
    }
  }
}

async function saveLegacyProviderConfig(config: StoredAIConfig, activate: boolean): Promise<void> {
  const baseUrlKey = `ai_${config.provider}_base_url` as const;
  const modelKey = `ai_${config.provider}_model` as const;
  const apiKeyKey = `ai_${config.provider}_api_key` as const;
  const updates: Array<Promise<void>> = [
    updateSetting(baseUrlKey, config.baseUrl),
    updateSetting(modelKey, config.model),
    updateSetting(apiKeyKey, await encryptApiKey(config.apiKey)),
  ];
  if (activate) {
    updates.push(updateSetting('ai_provider_type', config.provider));
  }
  await Promise.all(updates);
}

export async function saveProviderConfig(
  config: StoredAIConfig,
  options: { activateProvider?: boolean; preserveApiKey?: boolean } = {}
): Promise<void> {
  if (config.provider === 'opencode') {
    await saveLegacyProviderConfig(config, options.activateProvider ?? false);
    return;
  }

  const profiles = await loadAIProfiles();
  const userConfig = { ...config, provider: config.provider as UserAIProvider };
  const existing = profiles.find(
    (profile) => profile.provider === userConfig.provider && profile.baseUrl === userConfig.baseUrl
  );
  const profileConfig = { ...userConfig, name: existing?.name ?? userConfig.provider };
  let profileId = existing?.id;
  if (existing) {
    await updateAIProfile(existing.id, profileConfig);
  } else {
    profileId = await createAIProfile(profileConfig, {
      activate: options.activateProvider ?? false,
    });
  }
  if (options.activateProvider) {
    if (!profileId) {
      throw new Error('AI profile could not be activated');
    }
    await activateAIProfile(profileId);
  }
}

export async function isAIConfigConfigured(): Promise<boolean> {
  const config = await loadAIConfig();
  return Boolean(config.baseUrl || config.model || config.apiKey);
}
