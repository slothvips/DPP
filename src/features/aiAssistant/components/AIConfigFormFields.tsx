import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AIProviderType } from '@/lib/ai/types';
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
  onProviderChange: (provider: AIProviderType) => void | Promise<void>;
  onBaseUrlChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
}

export function AIConfigFormFields({
  provider,
  baseUrl,
  model,
  apiKey,
  onProviderChange,
  onBaseUrlChange,
  onModelChange,
  onApiKeyChange,
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
        <Input
          id="ai-model"
          value={model}
          onChange={(event) => onModelChange(event.target.value)}
          placeholder={getModelPlaceholder(provider)}
        />
      </div>
    </>
  );
}
