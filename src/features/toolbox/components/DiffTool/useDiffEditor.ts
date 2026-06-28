import type * as Monaco from 'monaco-editor';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { loadMonaco } from '@/lib/monaco/loadMonaco';
import { logger } from '@/utils/logger';

function isDarkTheme(theme: string): boolean {
  return (
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  );
}

export function useDiffEditor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Monaco.editor.IStandaloneDiffEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const { theme } = useTheme();
  // 用 ref 跟踪最新 theme,供 initEditor 异步加载完成后读取
  // 避免"加载期间切换主题"的竞态:theme effect 已运行过(no-op),editor 停留旧主题
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const [editorError, setEditorError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;

    async function initEditor() {
      if (!containerRef.current) return;

      try {
        const monaco = await loadMonaco();
        if (disposed || !containerRef.current) return;

        monacoRef.current = monaco;

        const originalModel = monaco.editor.createModel('', 'text/plain');
        const modifiedModel = monaco.editor.createModel('', 'text/plain');
        const editor = monaco.editor.createDiffEditor(containerRef.current, {
          automaticLayout: true,
          readOnly: false,
          theme: isDarkTheme(themeRef.current) ? 'vs-dark' : 'vs',
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

        editor.setModel({
          original: originalModel,
          modified: modifiedModel,
        });
        editorRef.current = editor;
        setEditorError(null);

        // 加载完成后立即应用最新主题,修复竞态:
        // 若加载期间 theme 变化,theme effect 已 no-op,这里补齐
        monaco.editor.setTheme(isDarkTheme(themeRef.current) ? 'vs-dark' : 'vs');
      } catch (err) {
        if (disposed) return;
        const errorMessage = err instanceof Error ? err.message : '编辑器初始化失败';
        setEditorError(errorMessage);
        logger.error('[useDiffEditor] Monaco editor init error:', err);
      }
    }

    void initEditor();

    return () => {
      disposed = true;
      const editor = editorRef.current;
      if (editor) {
        const model = editor.getModel();
        model?.original.dispose();
        model?.modified.dispose();
        editor.dispose();
        editorRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const updateMonacoTheme = () => {
      monacoRef.current?.editor.setTheme(isDarkTheme(theme) ? 'vs-dark' : 'vs');
    };

    updateMonacoTheme();

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', updateMonacoTheme);
      return () => mediaQuery.removeEventListener('change', updateMonacoTheme);
    }
  }, [theme]);

  const handleSwap = useCallback(() => {
    const model = editorRef.current?.getModel();
    if (!model) return;

    const originalValue = model.original.getValue();
    const modifiedValue = model.modified.getValue();
    model.original.setValue(modifiedValue);
    model.modified.setValue(originalValue);
  }, []);

  return {
    containerRef,
    editorError,
    editorRef,
    handleSwap,
  };
}
