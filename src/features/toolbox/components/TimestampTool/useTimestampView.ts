import { useCallback, useMemo, useState } from 'react';
import { correctTimestampWithAI } from './aiFixer';
import { buildDateDetails, parseToDate } from './timestampShared';

function resetAiState(
  setAiError: (value: string | null) => void,
  setAiReasoning: (value: string | null) => void,
  setAiCorrectedInput: (value: string | null) => void
) {
  setAiError(null);
  setAiReasoning(null);
  setAiCorrectedInput(null);
}

export function useTimestampView() {
  const [timestampInput, setTimestampInput] = useState('');
  const [timezone, setTimezone] = useState('local');
  const [copied, setCopied] = useState<string | null>(null);
  const [isAiFixing, setIsAiFixing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiCorrectedInput, setAiCorrectedInput] = useState<string | null>(null);
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);

  const dateFromTimestamp = useMemo(() => parseToDate(timestampInput), [timestampInput]);
  const isInvalid = timestampInput.trim() !== '' && !dateFromTimestamp;
  const dateDetails = useMemo(
    () => (dateFromTimestamp ? buildDateDetails(dateFromTimestamp, timezone) : null),
    [dateFromTimestamp, timezone]
  );

  const handleTimezoneChange = useCallback((value: string) => {
    setTimezone(value);
    resetAiState(setAiError, setAiReasoning, setAiCorrectedInput);
  }, []);

  const handleInputChange = useCallback((value: string) => {
    setTimestampInput(value);
    resetAiState(setAiError, setAiReasoning, setAiCorrectedInput);
  }, []);

  const handleAiFix = useCallback(async () => {
    if (!timestampInput.trim()) return;

    const originalInput = timestampInput;
    setIsAiFixing(true);
    resetAiState(setAiError, setAiReasoning, setAiCorrectedInput);

    try {
      const result = await correctTimestampWithAI(timestampInput, new Date(), timezone);
      if (result.success && result.correctedInput) {
        setAiCorrectedInput(originalInput);
        setAiReasoning(result.reasoning || null);
        setTimestampInput(result.correctedInput);
      } else {
        setAiError(result.error || '无法修正输入');
        setAiReasoning(result.reasoning || null);
      }
    } catch {
      setAiError('AI 调用失败');
    } finally {
      setIsAiFixing(false);
    }
  }, [timestampInput, timezone]);

  const copyToClipboard = useCallback((text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  return {
    aiCorrectedInput,
    aiError,
    aiReasoning,
    copied,
    copyToClipboard,
    dateDetails,
    handleAiFix,
    handleInputChange,
    handleTimezoneChange,
    isAiFixing,
    isInvalid,
    timestampInput,
    timezone,
  };
}
