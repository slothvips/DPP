import { Loader2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import { browser } from 'wxt/browser';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/utils/cn';
import { PageAgentIcon } from './PageAgentIcon';

export interface PageAgentButtonProps {
  disabled?: boolean;
  className?: string;
  tabId?: number | null;
}

export function PageAgentButton({ disabled, className, tabId }: PageAgentButtonProps) {
  const [isInjecting, setIsInjecting] = useState(false);
  const { toast } = useToast();

  const handleInject = useCallback(async () => {
    if (isInjecting) return;

    setIsInjecting(true);
    try {
      const message =
        tabId != null
          ? { type: 'PAGE_AGENT_INJECT_WITH_TAB' as const, tabId }
          : { type: 'PAGE_AGENT_INJECT' as const };
      const response = await browser.runtime.sendMessage(message);
      if (response?.success) {
        // No toast needed - agent runs in background
      } else {
        toast(response?.error || '启动失败', 'error');
      }
    } catch (_error) {
      toast('启动失败', 'error');
    } finally {
      setIsInjecting(false);
    }
  }, [isInjecting, toast, tabId]);

  return (
    <button
      className={cn(
        'relative p-2 rounded-lg cursor-pointer',
        'transition-all duration-200',
        'hover:scale-110',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      onClick={handleInject}
      disabled={disabled || isInjecting}
      title="Page Agent - AI 操作页面"
      aria-label="启动 Page Agent"
      data-testid="page-agent-button"
    >
      {isInjecting ? (
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      ) : (
        <PageAgentIcon />
      )}
    </button>
  );
}
