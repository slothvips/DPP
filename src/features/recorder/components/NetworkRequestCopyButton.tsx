import { useState } from 'react';
import { logger } from '@/utils/logger';

interface NetworkRequestCopyButtonProps {
  text: string;
  label?: string;
}

export function NetworkRequestCopyButton({ text, label }: NetworkRequestCopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      logger.warn('Clipboard API not available');
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
      title={label || '复制'}
    >
      {copied ? (
        <svg
          className="w-3.5 h-3.5 text-success"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      )}
    </button>
  );
}
