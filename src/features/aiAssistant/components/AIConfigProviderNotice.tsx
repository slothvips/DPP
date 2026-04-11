import type { AIProviderType } from '@/lib/ai/types';

interface AIConfigProviderNoticeProps {
  provider: AIProviderType;
}

export function AIConfigProviderNotice({ provider }: AIConfigProviderNoticeProps) {
  if (provider !== 'anthropic') {
    return null;
  }

  return (
    <div className="rounded-md bg-amber-50 dark:bg-amber-950 p-3 text-xs text-amber-800 dark:text-amber-200">
      <p className="font-medium">⚠️ Page Agent 兼容性提示</p>
      <p className="mt-1">
        Page Agent 仅支持 OpenAI 兼容格式的 API。Anthropic 供应商使用 Anthropic 格式端点，无法使用
        Page Agent。如需使用 Page Agent，请切换到其他供应商或使用 OpenAI 兼容代理。
      </p>
    </div>
  );
}
