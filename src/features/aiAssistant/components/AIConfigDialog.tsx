// AI Config Dialog - Settings for AI Assistant
import { Settings } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { db } from '@/db';
import { DEFAULT_CONFIGS } from '@/lib/ai/provider';
import type { AIProviderType } from '@/lib/ai/types';
import { WEBLLM_MODELS } from '@/lib/ai/webllm';
import { decryptData, encryptData, loadKey } from '@/lib/crypto/encryption';
import { logger } from '@/utils/logger';

interface AIConfigDialogProps {
  children?: React.ReactNode;
  onSaved?: () => void;
}

const PROVIDER_OPTIONS: { value: AIProviderType; label: string }[] = [
  { value: 'ollama', label: 'Ollama (本地)' },
  { value: 'webllm', label: 'WebLLM (浏览器本地)' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic Claude' },
  { value: 'custom', label: '自定义 (OpenAI 兼容)' },
];

export function AIConfigDialog({ children, onSaved }: AIConfigDialogProps) {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<AIProviderType>('custom');
  const [baseUrl, setBaseUrl] = useState<string>(DEFAULT_CONFIGS.custom.baseUrl);
  const [model, setModel] = useState<string>(DEFAULT_CONFIGS.custom.model);
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);

  // Load existing config when dialog opens
  useEffect(() => {
    if (open) {
      loadConfig();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      // Load provider type
      const providerSetting = await db.settings.where('key').equals('ai_provider_type').first();
      const savedProvider = (providerSetting?.value as AIProviderType) || 'custom';
      setProvider(savedProvider);

      // Load provider-specific config
      await loadProviderConfig(savedProvider);
    } catch (err) {
      logger.error('[AIConfig] Failed to load config:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleProviderChange = (newProvider: AIProviderType) => {
    setProvider(newProvider);
    // Load saved config for the new provider
    loadProviderConfig(newProvider);
  };

  // Load config for a specific provider
  const loadProviderConfig = async (providerType: AIProviderType) => {
    const baseUrlKey = `ai_${providerType}_base_url` as const;
    const modelKey = `ai_${providerType}_model` as const;
    const apiKeyKey = `ai_${providerType}_api_key` as const;

    const savedBaseUrl = await db.settings.where('key').equals(baseUrlKey).first();
    const savedModel = await db.settings.where('key').equals(modelKey).first();
    const savedApiKey = await db.settings.where('key').equals(apiKeyKey).first();

    setBaseUrl((savedBaseUrl?.value as string) || DEFAULT_CONFIGS[providerType].baseUrl || '');
    setModel((savedModel?.value as string) || DEFAULT_CONFIGS[providerType].model || '');

    // Load and decrypt API key
    if (savedApiKey?.value) {
      try {
        const encryptionKey = await loadKey();
        if (encryptionKey) {
          const decrypted = await decryptData(
            savedApiKey.value as { ciphertext: string; iv: string },
            encryptionKey
          );
          setApiKey(decrypted as string);
        } else {
          setApiKey(savedApiKey.value as string);
        }
      } catch (err) {
        logger.error('[AIConfig] Failed to decrypt API key:', err);
        setApiKey('');
      }
    } else {
      setApiKey('');
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // Save provider type
      await db.settings.put({ key: 'ai_provider_type', value: provider });

      // Save provider-specific config
      const baseUrlKey = `ai_${provider}_base_url` as const;
      const modelKey = `ai_${provider}_model` as const;
      const apiKeyKey = `ai_${provider}_api_key` as const;

      await db.settings.put({ key: baseUrlKey, value: baseUrl });
      await db.settings.put({ key: modelKey, value: model });

      // Encrypt and save API key (if provided)
      if (apiKey) {
        const encryptionKey = await loadKey();
        if (encryptionKey) {
          const encrypted = await encryptData(apiKey, encryptionKey);
          await db.settings.put({ key: apiKeyKey, value: encrypted });
        } else {
          // Fallback: store without encryption if no key available
          await db.settings.put({ key: apiKeyKey, value: apiKey });
        }
      } else {
        // Clear API key if empty
        await db.settings.put({ key: apiKeyKey, value: '' });
      }

      setOpen(false);
      onSaved?.();
    } catch (err) {
      logger.error('[AIConfig] Failed to save config:', err);
    } finally {
      setLoading(false);
    }
  };

  const showApiKey = provider !== 'ollama' && provider !== 'webllm';
  const showBaseUrl = provider !== 'webllm';
  const showModelField = true;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="ghost" size="sm" title="AI 设置">
            <Settings className="w-4 h-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>AI 设置</DialogTitle>
          <DialogDescription>配置 AI 模型服务连接信息</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Provider Selection */}
          <div className="grid gap-2">
            <Label htmlFor="ai-provider">服务商</Label>
            <Select
              value={provider}
              onValueChange={(v) => handleProviderChange(v as AIProviderType)}
            >
              <SelectTrigger id="ai-provider">
                <SelectValue placeholder="选择服务商" />
              </SelectTrigger>
              <SelectContent>
                {PROVIDER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* API Key (for non-Ollama) */}
          {showApiKey && (
            <div className="grid gap-2">
              <Label htmlFor="ai-api-key">API Key</Label>
              <Input
                id="ai-api-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={provider === 'anthropic' ? 'sk-ant-...' : 'sk-...'}
              />
            </div>
          )}

          {/* Base URL */}
          {showBaseUrl && (
            <div className="grid gap-2">
              <Label htmlFor="ai-base-url">服务地址</Label>
              <Input
                id="ai-base-url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={
                  provider === 'ollama'
                    ? 'http://localhost:11434'
                    : provider === 'anthropic'
                      ? 'https://api.anthropic.com'
                      : 'https://api.openai.com/v1'
                }
              />
            </div>
          )}

          {/* Model */}
          {showModelField && (
            <div className="grid gap-2">
              <Label htmlFor="ai-model">模型</Label>
              {provider === 'webllm' ? (
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger id="ai-model">
                    <SelectValue placeholder="选择模型" />
                  </SelectTrigger>
                  <SelectContent>
                    {WEBLLM_MODELS.map((m) => (
                      <SelectItem key={m.name} value={m.name}>
                        {m.name} ({m.size})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="ai-model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder={
                    provider === 'ollama'
                      ? 'llama3.2'
                      : provider === 'anthropic'
                        ? 'claude-3-5-sonnet-20241022'
                        : 'gpt-4o-mini'
                  }
                />
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Check if AI config is configured (has values in settings)
 */
export async function isAIConfigConfigured(): Promise<boolean> {
  const providerSetting = await db.settings.where('key').equals('ai_provider_type').first();
  const baseUrlSetting = await db.settings.where('key').equals('ai_base_url').first();
  const modelSetting = await db.settings.where('key').equals('ai_model').first();
  return !!(providerSetting?.value || baseUrlSetting?.value || modelSetting?.value);
}
