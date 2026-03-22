import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Clipboard,
  Copy,
  Download,
  Loader2,
  Trash2,
  Upload,
  Zap,
} from 'lucide-react';
import * as monaco from 'monaco-editor';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/useTheme';
import { createProvider } from '@/lib/ai/provider';
import type { AIProviderType, ChatMessage } from '@/lib/ai/types';
import { getAIConfig } from '@/lib/db/settings';

// Monaco Worker 配置
self.MonacoEnvironment = {
  getWorker: function (_moduleId: string, label: string) {
    const getWorkerModule = (moduleUrl: string, label: string) => {
      return new Worker(self.MonacoEnvironment!.getWorkerUrl!(moduleUrl, label), {
        name: label,
        type: 'module',
      });
    };
    switch (label) {
      case 'json':
      case 'css':
      case 'scss':
      case 'less':
      case 'html':
      case 'handlebars':
      case 'razor':
      case 'typescript':
      case 'javascript':
      default:
        return getWorkerModule('/monaco-editor/esm/vs/editor/editor.worker?worker', label);
    }
  },
};

export function JsonView({ onBack }: { onBack?: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const { theme } = useTheme();

  const [isFormatted, setIsFormatted] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [aiFixing, setAiFixing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // 验证 JSON
  const validateJson = useCallback((value: string) => {
    if (!value.trim()) {
      setError(null);
      return true;
    }
    try {
      JSON.parse(value);
      setError(null);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid JSON';
      setError(message);
      return false;
    }
  }, []);

  // 格式化 JSON
  const handleFormat = useCallback(() => {
    if (!editorRef.current) return;
    const value = editorRef.current.getValue();
    if (!value.trim()) return;

    try {
      const parsed = JSON.parse(value);
      const formatted = JSON.stringify(parsed, null, 2);
      editorRef.current.setValue(formatted);
      setIsFormatted(true);
      setError(null);
    } catch {
      // 保持原值，让错误显示出来
    }
  }, []);

  // 压缩 JSON
  const handleMinify = useCallback(() => {
    if (!editorRef.current) return;
    const value = editorRef.current.getValue();
    if (!value.trim()) return;

    try {
      const parsed = JSON.parse(value);
      const minified = JSON.stringify(parsed);
      editorRef.current.setValue(minified);
      setIsFormatted(false);
      setError(null);
    } catch {
      // 保持原值，让错误显示出来
    }
  }, []);

  // 复制内容
  const handleCopy = useCallback(() => {
    if (!editorRef.current) return;
    navigator.clipboard.writeText(editorRef.current.getValue());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  // 复制错误信息
  const handleCopyError = useCallback(() => {
    if (error) {
      navigator.clipboard.writeText(error);
    }
  }, [error]);

  // 导出文件
  const handleExport = useCallback(() => {
    if (!editorRef.current) return;
    const value = editorRef.current.getValue();
    if (!value) return;

    const blob = new Blob([value], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'data.json';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // 导入文件
  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      if (editorRef.current) {
        editorRef.current.setValue(text);
        validateJson(text);
      }
    };
    input.click();
  }, [validateJson]);

  // 清空
  const handleClear = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.setValue('');
      setError(null);
    }
  }, []);

  // 从文本中提取 JSON
  const extractJson = (text: string): string | null => {
    // 先去掉思考内容（Claude thinking 扩展等）
    let cleaned = text
      .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
      .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .trim();

    // 方法1: 提取代码块中的 JSON
    const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      const extracted = codeBlockMatch[1].trim();
      try {
        JSON.parse(extracted);
        return extracted;
      } catch {
        // 继续尝试其他方法
      }
    }

    // 方法2: 查找 { ... } 或 [ ... ] 块
    const jsonBlockMatch = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonBlockMatch) {
      const extracted = jsonBlockMatch[1].trim();
      try {
        JSON.parse(extracted);
        return extracted;
      } catch {
        // 继续尝试
      }
    }

    // 方法3: 去掉前后的非 JSON 字符
    // 去掉开头的说明文字
    cleaned = cleaned.replace(/^[\s\S]*?(?=\{|\[)/, '');
    // 去掉结尾的说明文字
    cleaned = cleaned.replace(/[^}\]][\s\S]*$/, '');
    try {
      JSON.parse(cleaned);
      return cleaned;
    } catch {
      // 方法4: 尝试找到最外层的 JSON 结构
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      const firstBracket = cleaned.indexOf('[');
      const lastBracket = cleaned.lastIndexOf(']');

      let start = firstBrace;
      let end = lastBrace;
      if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
        start = firstBracket;
        end = lastBracket;
      }

      if (start !== -1 && end !== -1 && end > start) {
        const candidate = cleaned.slice(start, end + 1);
        try {
          JSON.parse(candidate);
          return candidate;
        } catch {
          // 所有方法都失败
        }
      }
    }

    return null;
  };

  // AI 修复
  const handleAIFix = useCallback(async () => {
    if (!editorRef.current) return;
    const value = editorRef.current.getValue();
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

      const prompt = `请修复以下 JSON 语法错误，只返回修复后的 JSON，不要有任何其他解释。如果 JSON 本身没有问题，也请直接返回原内容。

【错误 JSON】
${value}`;

      const messages: ChatMessage[] = [{ role: 'user', content: prompt }];

      let fullContent = '';

      await provider.chat(messages, {
        stream: true,
        onChunk: (chunk) => {
          fullContent += chunk;
        },
      });

      const fixedJson = extractJson(fullContent);

      if (fixedJson) {
        // 格式化后写入
        try {
          const parsed = JSON.parse(fixedJson);
          const formatted = JSON.stringify(parsed, null, 2);
          editorRef.current.setValue(formatted);
          setError(null);
          setIsFormatted(true);
        } catch {
          editorRef.current.setValue(fixedJson);
          setError(null);
        }
      } else {
        console.error('[JsonView] AI response:', fullContent);
        setAiError('无法从 AI 回复中提取有效的 JSON');
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI 修复失败');
    } finally {
      setAiFixing(false);
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const isDark =
      theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    editorRef.current = monaco.editor.create(containerRef.current, {
      value: '{\n  \n}',
      language: 'json',
      theme: isDark ? 'vs-dark' : 'vs',
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 13,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      lineNumbers: 'on',
      wordWrap: 'on',
      scrollBeyondLastLine: false,
      renderLineHighlight: 'all',
      tabSize: 2,
      formatOnPaste: true,
      formatOnType: true,
      folding: true,
      foldingStrategy: 'auto',
      foldingHighlight: true,
      showFoldingControls: 'always',
      bracketPairColorization: { enabled: true },
      guides: {
        bracketPairs: true,
        indentation: true,
      },
      padding: { top: 8, bottom: 8 },
      scrollbar: {
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10,
      },
    });

    // 监听内容变化
    editorRef.current.onDidChangeModelContent(() => {
      const value = editorRef.current?.getValue() || '';
      validateJson(value);
    });

    return () => {
      editorRef.current?.dispose();
    };
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

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', updateMonacoTheme);
      return () => mediaQuery.removeEventListener('change', updateMonacoTheme);
    }
  }, [theme]);

  return (
    <div className="flex flex-col h-full w-full" data-testid="json-view">
      {/* 头部 */}
      <div className="flex items-center justify-between p-4 border-b border-border shrink-0 bg-background">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} title="返回工具箱">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <h2 className="text-lg font-semibold text-foreground">JSON 编辑器</h2>
          <p className="text-sm text-muted-foreground">
            {isFormatted ? '已格式化' : '已压缩'}
            {error && <span className="text-destructive ml-2">• 有错误</span>}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={handleImport} title="导入文件">
            <Upload className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleExport} title="导出文件">
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleClear} title="清空">
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            title="复制"
            disabled={!editorRef.current?.getValue()}
          >
            {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* 错误面板 */}
      {error && (
        <div className="border-b border-border bg-destructive/10">
          <button
            onClick={() => setShowErrors(!showErrors)}
            className="flex items-center justify-between w-full px-4 py-2 text-sm font-medium text-destructive hover:text-destructive/80 transition-colors"
          >
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-destructive" />
              JSON 语法错误
            </span>
            {showErrors ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showErrors && (
            <div className="px-4 pb-3">
              <div className="flex items-start justify-between gap-2">
                <code className="text-sm text-destructive/80 bg-destructive/5 px-2 py-1 rounded font-mono break-all">
                  {error}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={handleCopyError}
                >
                  <Clipboard className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 操作栏 */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/30 shrink-0">
        <Button size="sm" variant="outline" onClick={handleFormat} disabled={!!error || aiFixing}>
          格式化
        </Button>
        <Button size="sm" variant="outline" onClick={handleMinify} disabled={!!error || aiFixing}>
          压缩
        </Button>
        <Button size="sm" variant="outline" onClick={handleAIFix} disabled={aiFixing}>
          {aiFixing ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <Zap className="h-3 w-3 mr-1" />
          )}
          AI 修复
        </Button>
        {aiError && <span className="text-xs text-destructive ml-2">{aiError}</span>}
      </div>

      {/* Monaco Editor */}
      <div ref={containerRef} className="flex-1 min-h-0" />
    </div>
  );
}
