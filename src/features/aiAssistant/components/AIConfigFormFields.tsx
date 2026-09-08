import { Eye, EyeOff, RefreshCw } from 'lucide-react';
import { useState } from 'react';
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
import type { AIConfigValidationErrors } from '../lib/aiConfigDialogValidation';
import { AIConfigProviderNotice } from './AIConfigProviderNotice';
import {
  PROVIDER_OPTIONS,
  getApiKeyPlaceholder,
  getBaseUrlPlaceholder,
  getModelPlaceholder,
  getProviderLabel,
  shouldShowApiKey,
} from './aiConfigDialogShared';

interface AIConfigFormFieldsProps {
  provider: AIProviderType;
  baseUrl: string;
  model: string;
  apiKey: string;
  contextWindow?: number;
  profileName: string;
  isNew: boolean;
  errors: AIConfigValidationErrors;
  onProviderChange: (provider: AIProviderType) => void | Promise<void>;
  onBaseUrlChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  onContextWindowChange: (value: number | undefined) => void;
  onProfileNameChange: (value: string) => void;
  onClearError: (field: keyof AIConfigValidationErrors) => void;
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
  isNew,
  errors,
  onProviderChange,
  onBaseUrlChange,
  onModelChange,
  onApiKeyChange,
  onContextWindowChange,
  onProfileNameChange,
  onClearError,
  modelOptions,
  modelsLoading,
  modelLoadError,
  onRefreshModels,
}: AIConfigFormFieldsProps) {
  const [showApiKey, setShowApiKey] = useState(false);
  const requiresApiKey = shouldShowApiKey(provider);

  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <Label>服务类型</Label>
        {isNew ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {PROVIDER_OPTIONS.filter((option) => option.value !== 'opencode').map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => void onProviderChange(option.value)}
                aria-pressed={provider === option.value}
                className={`min-h-10 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  provider === option.value
                    ? 'border-primary bg-primary/8 font-medium text-primary'
                    : 'border-border bg-background text-foreground hover:bg-muted/50'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm font-medium">
            {getProviderLabel(provider)}
          </div>
        )}
      </div>

      <AIConfigProviderNotice provider={provider} model={model} />

      {provider !== 'opencode' && (
        <div className="grid gap-2">
          <Label htmlFor="ai-profile-name">配置名称</Label>
          <Input
            id="ai-profile-name"
            value={profileName}
            onChange={(event) => {
              onProfileNameChange(event.target.value);
              onClearError('profileName');
            }}
            placeholder="例如：工作账号"
            aria-invalid={Boolean(errors.profileName)}
            className={errors.profileName ? 'border-destructive' : undefined}
          />
          {errors.profileName && <p className="text-xs text-destructive">{errors.profileName}</p>}
        </div>
      )}

      {requiresApiKey && (
        <div className="grid gap-2">
          <Label htmlFor="ai-api-key">API Key</Label>
          <div className="relative">
            <Input
              id="ai-api-key"
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(event) => {
                onApiKeyChange(event.target.value);
                onClearError('apiKey');
              }}
              placeholder={getApiKeyPlaceholder(provider)}
              aria-invalid={Boolean(errors.apiKey)}
              className={`pr-10 ${errors.apiKey ? 'border-destructive' : ''}`}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1 h-8 w-8 text-muted-foreground"
              onClick={() => setShowApiKey((visible) => !visible)}
              aria-label={showApiKey ? '隐藏 API Key' : '显示 API Key'}
              title={showApiKey ? '隐藏 API Key' : '显示 API Key'}
            >
              {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          {errors.apiKey && <p className="text-xs text-destructive">{errors.apiKey}</p>}
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor="ai-base-url">服务地址</Label>
        <Input
          id="ai-base-url"
          value={baseUrl}
          onChange={(event) => {
            onBaseUrlChange(event.target.value);
            onClearError('baseUrl');
          }}
          placeholder={getBaseUrlPlaceholder(provider)}
          aria-invalid={Boolean(errors.baseUrl)}
          className={errors.baseUrl ? 'border-destructive' : undefined}
        />
        {errors.baseUrl && <p className="text-xs text-destructive">{errors.baseUrl}</p>}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="ai-model">模型</Label>
        <div className="flex items-start gap-2">
          {provider === 'opencode' && modelOptions.length > 0 ? (
            <Select
              value={model}
              onValueChange={(value) => {
                onModelChange(value);
                onClearError('model');
              }}
            >
              <SelectTrigger id="ai-model" className="min-w-0 flex-1">
                <SelectValue placeholder="选择可用模型" />
              </SelectTrigger>
              <SelectContent>
                {modelOptions.map((option) => (
                  <SelectItem key={option.name} value={option.name}>
                    {option.name}
                    {option.availability === 'available' && '（可用）'}
                    {option.availability === 'unavailable' && '（当前不可用）'}
                    {option.availability === 'checking' && '（检测中）'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              id="ai-model"
              className={`min-w-0 flex-1 ${errors.model ? 'border-destructive' : ''}`}
              value={model}
              onChange={(event) => {
                onModelChange(event.target.value);
                onClearError('model');
              }}
              placeholder={getModelPlaceholder(provider)}
              aria-invalid={Boolean(errors.model)}
            />
          )}
          {provider === 'opencode' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 shrink-0"
              onClick={onRefreshModels}
              disabled={modelsLoading}
            >
              <RefreshCw className={`mr-1.5 h-4 w-4 ${modelsLoading ? 'animate-spin' : ''}`} />
              {modelsLoading ? '获取中...' : '获取模型'}
            </Button>
          )}
        </div>
        {modelsLoading && <p className="text-xs text-muted-foreground">正在获取并检测模型...</p>}
        {modelLoadError && <p className="text-xs text-destructive">{modelLoadError}</p>}
        {errors.model && <p className="text-xs text-destructive">{errors.model}</p>}
      </div>

      <details className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
        <summary className="cursor-pointer select-none text-sm font-medium text-foreground">
          高级设置
        </summary>
        <div className="mt-3 grid gap-2 border-t border-border/60 pt-3">
          <Label htmlFor="ai-context-window">上下文窗口</Label>
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
      </details>
    </div>
  );
}
