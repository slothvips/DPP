import * as monaco from 'monaco-editor';
import 'monaco-editor/esm/vs/base/browser/ui/codicons/codicon/codicon.css';
import 'monaco-editor/min/vs/editor/editor.main.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { setupMonacoWorker } from '@/lib/monaco/worker';
import { validateJsonText } from './jsonUtils';

setupMonacoWorker();

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
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const { theme } = useTheme();
  const initialThemeRef = useRef(theme);
  const [error, setError] = useState<string | null>(null);

  const validateEditorValue = useCallback((value: string) => {
    const validationError = validateJsonText(value);
    setError(validationError);
    return validationError == null;
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    forceShowFoldIcons();

    editorRef.current = monaco.editor.create(containerRef.current, {
      value: '{\n  \n}',
      language: 'json',
      theme: isDarkTheme(initialThemeRef.current) ? 'vs-dark' : 'vs',
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

    return () => {
      editorRef.current?.dispose();
      editorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const updateMonacoTheme = () => {
      monaco.editor.setTheme(isDarkTheme(theme) ? 'vs-dark' : 'vs');
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
