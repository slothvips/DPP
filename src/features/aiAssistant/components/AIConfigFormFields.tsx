import { Copy, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AIProviderType, Model } from '@/lib/ai/types';
import {
  PROVIDER_OPTIONS,
  getApiKeyPlaceholder,
  getBaseUrlPlaceholder,
  getModelPlaceholder,
  shouldShowApiKey,
} from './aiConfigDialogShared';

interface AIConfigFormFieldsProps {
  provider: AIProviderType;
  baseUrl: string;
  model: string;
  apiKey: string;
  contextWindow?: number;
  profileName: string;
  profiles: Array<{ id: string; name: string; provider: AIProviderType }>;
  selectedProfileId: string | null;
  onProviderChange: (provider: AIProviderType) => void | Promise<void>;
  onBaseUrlChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  onContextWindowChange: (value: number | undefined) => void;
  onProfileNameChange: (value: string) => void;
  onProfileChange: (value: string) => void;
  onDuplicateProfile: () => void;
  onDeleteProfile: () => void;
  modelOptions: Model[];
  modelsLoading: boolean;
  modelLoadError: string | null;
  onRefreshModels: () => void;
}

export function AIConfigFormFields({
  provider,
  baseUrl,
  model,
  apiKey,
  contextWindow,
  profileName,
  profiles,
  selectedProfileId,
  onProviderChange,
  onBaseUrlChange,
  onModelChange,
  onApiKeyChange,
  onContextWindowChange,
  onProfileNameChange,
  onProfileChange,
  onDuplicateProfile,
  onDeleteProfile,
  modelOptions,
  modelsLoading,
  modelLoadError,
  onRefreshModels,
}: AIConfigFormFieldsProps) {
  const showApiKey = shouldShowApiKey(provider);

  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor="ai-provider">服务商</Label>
        <Select
          value={provider}
          onValueChange={(value) => void onProviderChange(value as AIProviderType)}
        >
          <SelectTrigger id="ai-provider">
            <SelectValue placeholder="选择服务商" />
          </SelectTrigger>
          <SelectContent>
            {PROVIDER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {provider !== 'opencode' && (
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="ai-profile">配置档案</Label>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                title="复制当前档案"
                onClick={onDuplicateProfile}
                disabled={!selectedProfileId}
              >
                <Copy className="w-3.5 h-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                title="删除当前档案"
                onClick={onDeleteProfile}
                disabled={!selectedProfileId}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
          <Select value={selectedProfileId ?? 'new'} onValueChange={onProfileChange}>
            <SelectTrigger id="ai-profile">
              <SelectValue placeholder="新建配置档案" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new">新建配置档案</SelectItem>
              {profiles
                .filter((profile) => profile.provider === provider)
                .map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Input
            value={profileName}
            onChange={(event) => onProfileNameChange(event.target.value)}
            placeholder="配置名称"
            aria-label="配置名称"
          />
        </div>
      )}

      {showApiKey && (
        <div className="grid gap-2">
          <Label htmlFor="ai-api-key">API Key</Label>
          <Input
            id="ai-api-key"
            type="password"
            value={apiKey}
            onChange={(event) => onApiKeyChange(event.target.value)}
            placeholder={getApiKeyPlaceholder(provider)}
          />
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor="ai-base-url">服务地址</Label>
        <Input
          id="ai-base-url"
          value={baseUrl}
          onChange={(event) => onBaseUrlChange(event.target.value)}
          placeholder={getBaseUrlPlaceholder(provider)}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="ai-model">模型</Label>
        <div className="flex flex-wrap gap-2">
          <Input
            id="ai-model"
            className="min-w-0 flex-1"
            value={model}
            onChange={(event) => onModelChange(event.target.value)}
            placeholder={getModelPlaceholder(provider)}
          />
          {provider === 'opencode' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRefreshModels}
              disabled={modelsLoading}
            >
              {modelsLoading ? '可用性检测中...' : '获取并检测'}
            </Button>
          )}
        </div>
        {provider === 'opencode' && modelOptions.length > 0 && (
          <Select value={model} onValueChange={onModelChange}>
            <SelectTrigger aria-label="选择 OpenCode 免费模型">
              <SelectValue placeholder="选择已获取的模型" />
            </SelectTrigger>
            <SelectContent>
              {modelOptions.map((modelOption) => (
                <SelectItem
                  key={modelOption.name}
                  value={modelOption.name}
                  title={modelOption.availabilityError}
                >
                  {modelOption.name}
                  {modelOption.availability === 'available' && '（可用）'}
                  {modelOption.availability === 'unavailable' && '（不可用）'}
                  {modelOption.availability === 'checking' && '（可用性检测中）'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {provider === 'opencode' &&
          modelOptions.some((item) => item.availability === 'unavailable') && (
            <p className="text-xs text-muted-foreground">
              不可用模型仍保留在列表中，选择后可手动尝试；悬停模型名称可查看检测结果。
            </p>
          )}
        {modelLoadError && <p className="text-xs text-destructive">{modelLoadError}</p>}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="ai-context-window">上下文窗口（可选）</Label>
        <div className="relative">
          <Input
            id="ai-context-window"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={contextWindow ?? ''}
            onChange={(event) => {
              const value = event.target.value;
              const parsed = Number(value);
              onContextWindowChange(
                value && Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
              );
            }}
            placeholder="留空时自动探测"
            className="pr-16"
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
            tokens
          </span>
        </div>
      </div>
    </>
  );
}
