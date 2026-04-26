import { Send, Square } from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/utils/cn';

interface ChatInputProps {
  onSend: (content: string) => Promise<void>;
  onStop?: () => void;
  disabled: boolean;
  isRunning?: boolean;
  placeholder: string;
  /** Initial input value (used for preset prompts from other tabs) */
  initialInput?: string;
  /** Element to render above the input row */
  rightSlot?: React.ReactNode;
  /** Element to render between top row and input row */
  bottomSlot?: React.ReactNode;
}

/**
 * Chat input component with isolated state to prevent re-renders
 * of the message list when typing.
 */
export const ChatInput = memo(function ChatInput({
  onSend,
  onStop,
  disabled,
  isRunning = false,
  placeholder,
  initialInput = '',
  rightSlot,
  bottomSlot,
}: ChatInputProps) {
  const [input, setInput] = useState(initialInput);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync initialInput to input state when it changes (e.g., preset prompt from other tabs)
  useEffect(() => {
    if (initialInput) {
      setInput(initialInput);
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
    <div className="flex flex-col gap-2">
      {rightSlot}
      {bottomSlot}
      <div className="flex flex-1 items-end gap-2">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="min-h-[52px] max-h-32 flex-1 resize-none rounded-2xl border-border/70 bg-background px-4 py-3 shadow-none"
          rows={1}
          data-testid="ai-chat-input"
        />
        <Button
          onClick={isRunning ? onStop : handleSend}
          disabled={isRunning ? false : !input.trim() || disabled}
          size="icon"
          data-testid={isRunning ? 'ai-chat-stop' : 'ai-chat-send'}
          title={isRunning ? '停止' : '发送'}
          className={cn(
            'h-[52px] w-[52px] rounded-2xl transition-all duration-200',
            isRunning && 'border border-destructive/40 bg-destructive/8 hover:bg-destructive/12'
          )}
        >
          {isRunning ? (
            <div className="relative flex items-center justify-center">
              <Square className="h-3 w-3 fill-destructive text-destructive" />
            </div>
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
});
