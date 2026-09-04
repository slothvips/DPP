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
  /** Element to render inside the bottom-left input actions */
  leftSlot?: React.ReactNode;
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
  leftSlot,
  rightSlot,
  bottomSlot,
}: ChatInputProps) {
  const [input, setInput] = useState(initialInput);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasInput = input.trim().length > 0;
  const showStopAction = isRunning && (!queueWhileRunning || !hasInput);

  // Sync initialInput to input state when it changes (e.g., preset prompt from other tabs)
  useEffect(() => {
    if (initialInput) {
      setInput(initialInput);
      textareaRef.current?.focus();
    }
  }, [initialInput, initialInputKey]);

  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (!content || disabled || (isRunning && !queueWhileRunning)) return;
    setInput('');
    await onSend(content);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [input, disabled, isRunning, onSend, queueWhileRunning]);

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
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="min-h-[48px] min-w-0 flex-1 resize-none rounded-2xl border-border/70 bg-background px-4 py-3 shadow-none"
          rows={1}
          data-testid="ai-chat-input"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          {leftSlot && <div className="min-w-0 flex-1">{leftSlot}</div>}
          <div className="ml-auto flex shrink-0 items-center gap-2">
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
              className="h-10 w-10 rounded-xl text-muted-foreground"
              data-testid="ai-chat-file-button"
            >
              <FileUp className="h-4 w-4" />
            </Button>
            <Button
              onClick={showStopAction ? onStop : handleSend}
              disabled={showStopAction ? false : !hasInput || disabled}
              size="icon"
              data-testid={showStopAction ? 'ai-chat-stop' : 'ai-chat-send'}
              title={showStopAction ? '停止' : '发送'}
              aria-label={showStopAction ? '停止当前任务' : '发送消息'}
              className={cn(
                'h-10 w-10 rounded-xl transition-all duration-200',
                showStopAction &&
                  'border border-destructive/40 bg-destructive/8 hover:bg-destructive/12'
              )}
            >
              {showStopAction ? (
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
    </div>
  );
});
