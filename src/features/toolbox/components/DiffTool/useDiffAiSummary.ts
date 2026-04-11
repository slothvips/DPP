import type * as monaco from 'monaco-editor';
import { useCallback, useState } from 'react';
import { createProvider } from '@/lib/ai/provider';
import type { AIProviderType, ChatMessage } from '@/lib/ai/types';
import { getAIConfig } from '@/lib/db/settings';
import { buildDiffSummaryPrompt, getDiffEditorContent } from './diffAiShared';

export function useDiffAiSummary(
  editorRef: React.RefObject<monaco.editor.IStandaloneDiffEditor | null>
) {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleAISummarize = useCallback(async () => {
    const diffContent = getDiffEditorContent(editorRef);
    if (!diffContent) {
      return;
    }

    const { originalValue, modifiedValue } = diffContent;

    if (!originalValue.trim() && !modifiedValue.trim()) {
      setAiError('请先输入要对比的内容');
      setAiSummary(null);
      setShowAIPanel(true);
      return;
    }

    setAiLoading(true);
    setAiError(null);
    setAiSummary(null);
    setShowAIPanel(true);

    try {
      const config = await getAIConfig();
      if (!config || !config.model) {
        setAiError('请先在设置中配置 AI');
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
          content: buildDiffSummaryPrompt({
            originalValue,
            modifiedValue,
          }),
        },
      ];
      let fullContent = '';

      await provider.chat(messages, {
        stream: true,
        onChunk: (chunk) => {
          fullContent += chunk;
          setAiSummary(fullContent);
        },
      });
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'AI 解读失败');
    } finally {
      setAiLoading(false);
    }
  }, [editorRef]);

  const handleCopySummary = useCallback(() => {
    if (!aiSummary) {
      return;
    }

    navigator.clipboard.writeText(aiSummary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [aiSummary]);

  return {
    aiError,
    aiLoading,
    aiSummary,
    copied,
    handleAISummarize,
    handleCopySummary,
    setShowAIPanel,
    showAIPanel,
  };
}
