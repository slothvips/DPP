import { useCallback, useState } from 'react';
import { formatJsonText, minifyJsonText } from './jsonUtils';
import { useJsonAiFix } from './useJsonAiFix';
import { useJsonEditor } from './useJsonEditor';

export function useJsonView() {
  const { containerRef, error, getValue, setError, setValue } = useJsonEditor();
  const [isFormatted, setIsFormatted] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const { aiError, aiFixing, handleAIFix } = useJsonAiFix({
    getValue,
    onFixed: (value, formatted) => {
      setValue(value, false);
      setIsFormatted(formatted);
    },
    onValidationReset: () => setError(null),
  });

  const handleFormat = useCallback(() => {
    const formatted = formatJsonText(getValue());
    if (!formatted) {
      return;
    }

    setValue(formatted, true);
    setIsFormatted(true);
  }, [getValue, setValue]);

  const handleMinify = useCallback(() => {
    const minified = minifyJsonText(getValue());
    if (!minified) {
      return;
    }

    setValue(minified, true);
    setIsFormatted(false);
  }, [getValue, setValue]);

  const handleCopy = useCallback(() => {
    const value = getValue();
    if (!value) {
      return;
    }

    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [getValue]);

  const handleCopyError = useCallback(() => {
    if (error) {
      navigator.clipboard.writeText(error);
    }
  }, [error]);

  const handleExport = useCallback(() => {
    const value = getValue();
    if (!value) {
      return;
    }

    const blob = new Blob([value], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'data.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }, [getValue]);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) {
        return;
      }

      const text = await file.text();
      setValue(text, true);
    };
    input.click();
  }, [setValue]);

  const handleClear = useCallback(() => {
    setValue('', true);
  }, [setValue]);

  return {
    aiError,
    aiFixing,
    containerRef,
    copied,
    error,
    handleAIFix,
    handleClear,
    handleCopy,
    handleCopyError,
    handleExport,
    handleFormat,
    handleImport,
    handleMinify,
    isFormatted,
    showErrors,
    toggleErrors: () => setShowErrors((current) => !current),
    hasValue: Boolean(getValue()),
  };
}
