import { isOpenCodeFreeModel } from '@/lib/ai/openCodeProviderShared';
import type { AIProviderType } from '@/lib/ai/types';

interface AIConfigProviderNoticeProps {
  provider: AIProviderType;
  model?: string;
}

export function AIConfigProviderNotice({ provider, model }: AIConfigProviderNoticeProps) {
  if (provider === 'opencode') {
    return isOpenCodeFreeModel(model ?? '') ? (
      <div className="rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">
        OpenCode 免费模型现已收紧为仅官方 OpenCode 客户端可用，本扩展调用会被拒绝（HTTP 403）。
        <span className="text-destructive">
          请改用自己的 API Key：OpenCode Zen 付费 Key，或其它 OpenAI 兼容服务。
        </span>
      </div>
    ) : (
      <div className="rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">
        OpenCode 模型列表会动态获取，模型可用性以检测结果为准；付费模型需要填入你自己的 API Key。
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
