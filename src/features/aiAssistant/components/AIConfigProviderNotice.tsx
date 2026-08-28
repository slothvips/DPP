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
        OpenCode 免费模型免注册即可使用，但性能较弱、响应慢，且可能限流或受地区限制，
        <span className="text-destructive">
          建议仅用于临时体验，不要作为主力模型，避免影响你的使用体验。
        </span>
      </div>
    ) : (
      <div className="rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">
        OpenCode 模型列表会动态获取，模型可用性以检测结果为准。
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
