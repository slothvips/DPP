import { Check, ChevronUp, ChevronsLeftRight, Copy, Sparkles } from 'lucide-react';
import * as monaco from 'monaco-editor';
import remarkGfm from 'remark-gfm';
import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/useTheme';
import { createProvider } from '@/lib/ai/provider';
import type { AIProviderType, ChatMessage } from '@/lib/ai/types';
import { getAIConfig } from '@/lib/db/settings';
import { setupMonacoWorker } from '@/lib/monaco/worker';
import { logger } from '@/utils/logger';

// 初始化 Monaco Worker
setupMonacoWorker();

export function DiffView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneDiffEditor | null>(null);
  const { theme } = useTheme();

  // AI 解读状态
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);

  // AI 解读函数
  const handleAISummarize = useCallback(async () => {
    if (!editorRef.current) return;

    const model = editorRef.current.getModel();
    if (!model) return;

    const originalValue = model.original.getValue();
    const modifiedValue = model.modified.getValue();

    // 如果两边都为空，不调用 AI
    if (!originalValue.trim() && !modifiedValue.trim()) {
      setAiError('请先输入要对比的内容');
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
        setAiLoading(false);
        return;
      }

      const provider = createProvider(
        config.provider as AIProviderType,
        config.baseUrl,
        config.model,
        config.apiKey
      );

      const diffContent = `请对比以下两段文本的差异，按以下格式输出：

### 统计
- 新增：X 行
- 删除：X 行
- 修改：X 处

### 主要变化
1. [具体变化1]
2. [具体变化2]
3. [具体变化3]

### 重点关注
- [需要特别注意的地方]

---

【原文】
${originalValue || '(空)'}

【修改后】
${modifiedValue || '(空)'}`;

      const messages: ChatMessage[] = [{ role: 'user', content: diffContent }];

      let fullContent = '';

      await provider.chat(messages, {
        stream: true,
        onChunk: (chunk) => {
          fullContent += chunk;
          setAiSummary(fullContent);
        },
      });
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI 解读失败');
    } finally {
      setAiLoading(false);
    }
  }, []);

  // 复制解读内容
  const handleCopySummary = useCallback(() => {
    if (aiSummary) {
      navigator.clipboard.writeText(aiSummary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [aiSummary]);

  useEffect(() => {
    if (!containerRef.current) return;

    try {
      const isDark =
        theme === 'dark' ||
        (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

      // 创建 Diff Editor
      editorRef.current = monaco.editor.createDiffEditor(containerRef.current, {
        automaticLayout: true,
        readOnly: false,
        theme: isDark ? 'vs-dark' : 'vs',
        renderSideBySide: true,
        ignoreTrimWhitespace: false,
        renderOverviewRuler: true,
        scrollBeyondLastLine: false,
        originalEditable: true,
        enableSplitViewResizing: true,
        fontSize: 13,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        minimap: { enabled: false },
        lineNumbers: 'on',
        wordWrap: 'on',
        renderLineHighlight: 'all',
      });

      // 创建初始空模型
      const originalModel = monaco.editor.createModel('', 'text/plain');
      const modifiedModel = monaco.editor.createModel('', 'text/plain');
      editorRef.current.setModel({
        original: originalModel,
        modified: modifiedModel,
      });

      setEditorError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '编辑器初始化失败';
      setEditorError(errorMessage);
      logger.error('[DiffView] Monaco editor init error:', err);
    }

    return () => {
      editorRef.current?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 监听主题变化
  useEffect(() => {
    const updateMonacoTheme = () => {
      const isDark =
        theme === 'dark' ||
        (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      monaco.editor.setTheme(isDark ? 'vs-dark' : 'vs');
    };

    updateMonacoTheme();

    // 当主题为 system 时，监听系统主题变化
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', updateMonacoTheme);
      return () => mediaQuery.removeEventListener('change', updateMonacoTheme);
    }
  }, [theme]);

  const handleSwap = () => {
    if (!editorRef.current) return;
    const model = editorRef.current.getModel();
    if (!model) return;
    const originalValue = model.original.getValue();
    const modifiedValue = model.modified.getValue();
    model.original.setValue(modifiedValue);
    model.modified.setValue(originalValue);
  };

  return (
    <div className="flex flex-col h-full w-full" data-testid="diff-view">
      {/* 头部 */}
      <div className="flex items-center justify-between p-4 border-b border-border shrink-0 bg-background">
        <div>
          <h2 className="text-lg font-semibold text-foreground">文本差异对比工具</h2>
          <p className="text-sm text-muted-foreground">双栏编辑，差异高亮</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleAISummarize}
            title="AI 解读"
            disabled={aiLoading}
          >
            {aiLoading ? (
              <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
          </Button>
          <Button variant="outline" size="icon" onClick={handleSwap} title="交换内容">
            <ChevronsLeftRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* AI 解读面板 */}
      {showAIPanel && (
        <div className="border-b border-border bg-muted/30">
          <button
            onClick={() => setShowAIPanel(false)}
            className="flex items-center justify-between w-full px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              AI 解读
            </span>
            <ChevronUp className="h-4 w-4" />
          </button>
          <div className="px-4 pb-4 max-h-48 overflow-y-auto">
            {aiLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                正在解读差异...
              </div>
            )}
            {aiError && <div className="text-sm text-destructive">{aiError}</div>}
            {aiSummary && (
              <div className="relative group">
                <div className="text-sm text-foreground [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-0.5 [&_p]:m-0">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiSummary}</ReactMarkdown>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                  onClick={handleCopySummary}
                  title="复制"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            )}
            {!aiLoading && !aiError && !aiSummary && (
              <div className="text-sm text-muted-foreground">点击 Sparkles 图标获取 AI 解读</div>
            )}
          </div>
        </div>
      )}

      {/* Monaco Diff Editor */}
      {editorError ? (
        <div className="flex-1 min-h-0 flex items-center justify-center bg-muted/30">
          <div className="text-center p-4">
            <p className="text-destructive font-medium mb-2">编辑器加载失败</p>
            <p className="text-sm text-muted-foreground">{editorError}</p>
          </div>
        </div>
      ) : (
        <div ref={containerRef} className="flex-1 min-h-0" />
      )}
    </div>
  );
}
