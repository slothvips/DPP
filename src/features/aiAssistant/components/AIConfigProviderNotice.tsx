import type { AIProviderType } from '@/lib/ai/types';

interface AIConfigProviderNoticeProps {
  provider: AIProviderType;
}

export function AIConfigProviderNotice({ provider }: AIConfigProviderNoticeProps) {
  if (provider === 'opencode') {
    return (
      <div className="rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">
        OpenCode 免费模型列表会动态获取，模型可能限流或受地区限制。
      </div>
    );
  }

  if (provider === 'custom') {
    return (
      <div className="rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">
        适用于提供 OpenAI Chat Completions 兼容接口的其他服务。
      </div>
    );
  }

  return null;
}
