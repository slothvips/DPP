import { Send } from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface ChatInputProps {
  onSend: (content: string) => Promise<void>;
  disabled: boolean;
  placeholder: string;
  /** Initial input value (used for preset prompts from other tabs) */
  initialInput?: string;
}

/**
 * Chat input component with isolated state to prevent re-renders
 * of the message list when typing.
 */
export const ChatInput = memo(function ChatInput({
  onSend,
  disabled,
  placeholder,
  initialInput = '',
}: ChatInputProps) {
  const [input, setInput] = useState(initialInput);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea when initialInput is provided (preset prompt from other tabs)
  useEffect(() => {
    if (initialInput) {
      textareaRef.current?.focus();
    }
  }, [initialInput]);

  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (!content || disabled) return;
    setInput('');
    await onSend(content);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [input, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="flex gap-2">
      <Textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="min-h-[44px] max-h-32 resize-none"
        rows={1}
        data-testid="ai-chat-input"
      />
      <Button
        onClick={handleSend}
        disabled={!input.trim() || disabled}
        size="icon"
        data-testid="ai-chat-send"
      >
        <Send className="w-4 h-4" />
      </Button>
    </div>
  );
});
