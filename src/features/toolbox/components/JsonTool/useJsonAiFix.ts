import { useCallback, useState } from 'react';
import { createProvider } from '@/lib/ai/provider';
import type { AIProviderType, ChatMessage } from '@/lib/ai/types';
import { getAIConfig } from '@/lib/db/settings';
import { logger } from '@/utils/logger';
import { extractJsonFromText } from './jsonUtils';

interface UseJsonAiFixOptions {
  getValue: () => string;
  onFixed: (value: string, formatted: boolean) => void;
  onValidationReset: () => void;
}

export function useJsonAiFix({ getValue, onFixed, onValidationReset }: UseJsonAiFixOptions) {
  const [aiFixing, setAiFixing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const handleAIFix = useCallback(async () => {
    const value = getValue();
    if (!value.trim()) return;

    setAiFixing(true);
    setAiError(null);

    try {
      const config = await getAIConfig();
      if (!config || !config.model) {
        setAiError('请先在设置中配置 AI');
        setAiFixing(false);
        return;
      }

      const provider = createProvider(
        config.provider as AIProviderType,
        config.baseUrl,
        config.model,
        config.apiKey
      );

      const messages: ChatMessage[] = [
        {
          role: 'user',
          content: `请修复以下 JSON 语法错误，只返回修复后的 JSON，不要有任何其他解释。如果 JSON 本身没有问题，也请直接返回原内容。\n\n【错误 JSON】\n${value}`,
        },
      ];

      let fullContent = '';
      await provider.chat(messages, {
        stream: true,
        onChunk: (chunk) => {
          fullContent += chunk;
        },
      });

      const fixedJson = extractJsonFromText(fullContent);
      if (!fixedJson) {
        logger.error('[JsonView] AI response:', fullContent);
        setAiError('无法从 AI 回复中提取有效的 JSON');
        return;
      }

      try {
        const parsed = JSON.parse(fixedJson);
        onFixed(JSON.stringify(parsed, null, 2), true);
      } catch {
        onFixed(fixedJson, false);
      }
      onValidationReset();
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'AI 修复失败');
    } finally {
      setAiFixing(false);
    }
  }, [getValue, onFixed, onValidationReset]);

  return {
    aiError,
    aiFixing,
    handleAIFix,
  };
}
