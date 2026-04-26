import * as monaco from 'monaco-editor';
import 'monaco-editor/esm/vs/base/browser/ui/codicons/codicon/codicon.css';
import 'monaco-editor/min/vs/editor/editor.main.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { setupMonacoWorker } from '@/lib/monaco/worker';
import { logger } from '@/utils/logger';

setupMonacoWorker();

function isDarkTheme(theme: string): boolean {
  return (
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  );
}

export function useDiffEditor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneDiffEditor | null>(null);
  const { theme } = useTheme();
  const initialThemeRef = useRef(theme);
  const [editorError, setEditorError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    try {
      const originalModel = monaco.editor.createModel('', 'text/plain');
      const modifiedModel = monaco.editor.createModel('', 'text/plain');
      const editor = monaco.editor.createDiffEditor(containerRef.current, {
        automaticLayout: true,
        readOnly: false,
        theme: isDarkTheme(initialThemeRef.current) ? 'vs-dark' : 'vs',
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

      return () => {
        editor.dispose();
        originalModel.dispose();
        modifiedModel.dispose();
        editorRef.current = null;
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '编辑器初始化失败';
      setEditorError(errorMessage);
      logger.error('[useDiffEditor] Monaco editor init error:', err);
    }
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
