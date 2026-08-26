import { FileUp, Send, Square } from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/utils/cn';
import { parseInputFile } from '../utils/fileParser';

interface ChatInputProps {
  onSend: (content: string) => Promise<void>;
  onStop?: () => void;
  disabled: boolean;
  isRunning?: boolean;
  queueWhileRunning?: boolean;
  placeholder: string;
  /** Initial input value (used for preset prompts from other tabs) */
  initialInput?: string;
  /** Changes when the same preset text should be injected again. */
  initialInputKey?: string;
  onFileError?: (message: string) => void;
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
  queueWhileRunning = false,
  placeholder,
  initialInput = '',
  initialInputKey,
  onFileError,
  rightSlot,
  bottomSlot,
}: ChatInputProps) {
  const [input, setInput] = useState(initialInput);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync initialInput to input state when it changes (e.g., preset prompt from other tabs)
  useEffect(() => {
    if (initialInput) {
      setInput(initialInput);
      textareaRef.current?.focus();
    }
  }, [initialInput, initialInputKey]);

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

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;

      setIsReadingFile(true);
      try {
        const content = await parseInputFile(file);
        setInput((current) =>
          current ? `${current}\n\n--- ${file.name} ---\n${content}` : content
        );
        textareaRef.current?.focus();
      } catch (error) {
        onFileError?.(error instanceof Error ? error.message : '无法读取文件');
      } finally {
        setIsReadingFile(false);
      }
    },
    [onFileError]
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {rightSlot}
      {bottomSlot}
      <div className="relative min-h-0 flex-1">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="h-full min-h-[120px] max-h-none w-full resize-none rounded-2xl border-border/70 bg-background px-4 py-3 pb-16 pr-24 shadow-none"
          rows={1}
          data-testid="ai-chat-input"
        />
        <div className="pointer-events-none absolute bottom-2 right-2 flex items-center gap-2">
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.text,.md,.markdown,.xmind,text/plain,text/markdown"
              className="sr-only"
              onChange={(event) => void handleFileChange(event)}
              data-testid="ai-chat-file-input"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isReadingFile}
              title={isReadingFile ? '正在读取文件' : '选择文件'}
              aria-label={isReadingFile ? '正在读取文件' : '选择文件'}
              className="pointer-events-auto h-10 w-10 rounded-xl text-muted-foreground"
              data-testid="ai-chat-file-button"
            >
              <FileUp className="h-4 w-4" />
            </Button>
          </>
          {isRunning && queueWhileRunning && (
            <Button
              onClick={onStop}
              disabled={false}
              size="icon"
              title="停止当前任务"
              className="pointer-events-auto h-10 w-10 rounded-xl border border-destructive/40 bg-destructive/8 hover:bg-destructive/12"
            >
              <Square className="h-3 w-3 fill-destructive text-destructive" />
            </Button>
          )}
          <Button
            onClick={isRunning && !queueWhileRunning ? onStop : handleSend}
            disabled={
              isRunning && queueWhileRunning
                ? !input.trim()
                : isRunning
                  ? false
                  : !input.trim() || disabled
            }
            size="icon"
            data-testid={isRunning && !queueWhileRunning ? 'ai-chat-stop' : 'ai-chat-send'}
            title={isRunning ? '停止' : '发送'}
            className={cn(
              'pointer-events-auto h-10 w-10 rounded-xl transition-all duration-200',
              isRunning &&
                !queueWhileRunning &&
                'border border-destructive/40 bg-destructive/8 hover:bg-destructive/12'
            )}
          >
            {isRunning && !queueWhileRunning ? (
              <div className="relative flex items-center justify-center">
                <Square className="h-3 w-3 fill-destructive text-destructive" />
              </div>
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
});
