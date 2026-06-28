import type * as Monaco from 'monaco-editor';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { loadMonaco } from '@/lib/monaco/loadMonaco';
import { logger } from '@/utils/logger';
import { validateJsonText } from './jsonUtils';

function forceShowFoldIcons() {
  if (document.getElementById('monaco-fold-force-show')) {
    return;
  }

  const style = document.createElement('style');
  style.id = 'monaco-fold-force-show';
  style.textContent = `
    .monaco-editor .margin-view-overlays .codicon {
      opacity: 1 !important;
    }
  `;
  document.head.appendChild(style);
}

function isDarkTheme(theme: string): boolean {
  return (
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  );
}

export function useJsonEditor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const { theme } = useTheme();
  // 用 ref 跟踪最新 theme,供 initEditor 异步加载完成后读取
  // 避免"加载期间切换主题"的竞态:theme effect 已运行过(no-op),editor 停留旧主题
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const [error, setError] = useState<string | null>(null);

  const validateEditorValue = useCallback((value: string) => {
    const validationError = validateJsonText(value);
    setError(validationError);
    return validationError == null;
  }, []);

  useEffect(() => {
    let disposed = false;

    async function initEditor() {
      if (!containerRef.current) return;

      try {
        const monaco = await loadMonaco();
        if (disposed || !containerRef.current) return;

        monacoRef.current = monaco;
        forceShowFoldIcons();

        editorRef.current = monaco.editor.create(containerRef.current, {
          value: '{\n  \n}',
          language: 'json',
          theme: isDarkTheme(themeRef.current) ? 'vs-dark' : 'vs',
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
          foldingStrategy: 'indentation',
          foldingHighlight: true,
          showFoldingControls: 'always',
          bracketPairColorization: { enabled: true },
          guides: { bracketPairs: true, indentation: true },
          padding: { top: 8, bottom: 8 },
          scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
        });

        editorRef.current.onDidChangeModelContent(() => {
          validateEditorValue(editorRef.current?.getValue() || '');
        });

        // 加载完成后立即应用最新主题,修复竞态:
        // 若加载期间 theme 变化,theme effect 已 no-op,这里补齐
        monaco.editor.setTheme(isDarkTheme(themeRef.current) ? 'vs-dark' : 'vs');
      } catch (err) {
        logger.error('[useJsonEditor] Failed to load Monaco:', err);
      }
    }

    void initEditor();

    return () => {
      disposed = true;
      editorRef.current?.dispose();
      editorRef.current = null;
    };
  }, [validateEditorValue]);

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

  const setValue = useCallback(
    (value: string, shouldValidate = true) => {
      editorRef.current?.setValue(value);
      if (shouldValidate) {
        validateEditorValue(value);
      }
    },
    [validateEditorValue]
  );

  const getValue = useCallback(() => editorRef.current?.getValue() || '', []);

  return {
    containerRef,
    editorRef,
    error,
    getValue,
    setError,
    setValue,
    validateEditorValue,
  };
}
