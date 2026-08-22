import type * as Monaco from 'monaco-editor';
import remarkGfm from 'remark-gfm';
import 'virtual:uno.css';
import { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ToastProvider, useToast } from '@/components/ui/toast';
import { useTheme } from '@/hooks/useTheme';
import { getTestCase, saveTestCase } from '@/lib/db/testing';
import { loadMonaco } from '@/lib/monaco/loadMonaco';
import { logger } from '@/utils/logger';
import '@unocss/reset/tailwind.css';

function isDarkTheme(theme: string): boolean {
  return (
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  );
}

function MarkdownEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const { theme } = useTheme();
  valueRef.current = value;
  onChangeRef.current = onChange;

  useEffect(() => {
    let disposed = false;
    async function initialize() {
      if (!containerRef.current) return;
      try {
        const monaco = await loadMonaco();
        if (disposed || !containerRef.current) return;
        monacoRef.current = monaco;
        editorRef.current = monaco.editor.create(containerRef.current, {
          value: valueRef.current,
          language: 'markdown',
          theme: isDarkTheme(theme) ? 'vs-dark' : 'vs',
          automaticLayout: true,
          minimap: { enabled: false },
          fontSize: 14,
          wordWrap: 'on',
          scrollBeyondLastLine: false,
          padding: { top: 12, bottom: 12 },
        });
        editorRef.current.onDidChangeModelContent(() => {
          onChangeRef.current(editorRef.current?.getValue() ?? '');
        });
      } catch (error) {
        logger.error('[TestCaseEditor] 加载 Markdown 编辑器失败:', error);
      }
    }
    void initialize();
    return () => {
      disposed = true;
      editorRef.current?.dispose();
      editorRef.current = null;
    };
  }, [theme]);

  useEffect(() => {
    monacoRef.current?.editor.setTheme(isDarkTheme(theme) ? 'vs-dark' : 'vs');
  }, [theme]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || editor.hasTextFocus() || editor.getValue() === value) return;
    editor.setValue(value);
  }, [value]);

  return <div ref={containerRef} className="h-full min-h-0" />;
}

function TestCaseEditorPage() {
  const { toast } = useToast();
  const [id, setId] = useState<string | undefined>(
    () => new URLSearchParams(location.search).get('id') ?? undefined
  );
  const [name, setName] = useState('');
  const [instruction, setInstruction] = useState(
    '# 测试目标\n\n描述测试步骤、输入数据和预期结果。'
  );
  const [isLoading, setIsLoading] = useState(id !== undefined);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    void getTestCase(id)
      .then((testCase) => {
        if (!testCase) {
          toast('测试用例不存在', 'error');
          return;
        }
        setName(testCase.name);
        setInstruction(testCase.instruction);
      })
      .catch((error: unknown) => {
        logger.error('[TestCaseEditor] 加载测试用例失败:', error);
        toast(error instanceof Error ? error.message : '加载测试用例失败', 'error');
      })
      .finally(() => setIsLoading(false));
  }, [id, toast]);

  async function handleSave() {
    if (!name.trim() || !instruction.trim()) {
      toast('请填写用例名称和 Markdown 测试内容', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const saved = await saveTestCase({ id, name, instruction });
      setId(saved.id);
      history.replaceState(null, '', `?id=${encodeURIComponent(saved.id)}`);
      toast('测试用例已保存', 'success');
    } catch (error) {
      logger.error('[TestCaseEditor] 保存测试用例失败:', error);
      toast(error instanceof Error ? error.message : '保存测试用例失败', 'error');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background text-foreground">
      <header className="flex shrink-0 items-center gap-3 border-b border-border/60 px-6 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">DPP / 测试用例</p>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="输入测试用例名称"
            className="mt-1 h-9 max-w-xl border-0 bg-transparent px-0 text-lg font-semibold shadow-none focus-visible:ring-0"
            disabled={isLoading}
          />
        </div>
        <Button variant="outline" onClick={() => window.close()}>
          关闭
        </Button>
        <Button onClick={() => void handleSave()} disabled={isLoading || isSaving}>
          {isSaving ? '保存中...' : '保存用例'}
        </Button>
      </header>
      <main className="grid min-h-0 flex-1 grid-cols-2 gap-px bg-border/60">
        <section className="min-h-0 bg-background p-4">
          <div className="mb-2 flex items-center justify-between">
            <h1 className="text-sm font-semibold">Markdown 测试描述</h1>
            <span className="text-xs text-muted-foreground">步骤 / 输入 / 预期结果</span>
          </div>
          <div className="h-[calc(100%-2rem)] overflow-hidden rounded-xl border border-border/60">
            <MarkdownEditor value={instruction} onChange={setInstruction} />
          </div>
        </section>
        <section className="min-h-0 overflow-y-auto bg-background p-6">
          <h2 className="mb-3 text-sm font-semibold">预览</h2>
          <article className="markdown-preview prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{instruction}</ReactMarkdown>
          </article>
        </section>
      </main>
    </div>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <ToastProvider>
      <TestCaseEditorPage />
    </ToastProvider>
  );
}
