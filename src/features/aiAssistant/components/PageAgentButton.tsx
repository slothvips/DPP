import { Loader2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import { browser } from 'wxt/browser';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/utils/cn';
import { PageAgentIcon } from './PageAgentIcon';

export interface PageAgentButtonProps {
  disabled?: boolean;
  className?: string;
}

export function PageAgentButton({ disabled, className }: PageAgentButtonProps) {
  const [isInjecting, setIsInjecting] = useState(false);
  const { toast } = useToast();

  const handleInject = useCallback(async () => {
    if (isInjecting) return;

    setIsInjecting(true);
    try {
      const response = await browser.runtime.sendMessage({ type: 'PAGE_AGENT_INJECT' });
      if (response?.success) {
        toast('Page Agent 已启动，请在当前页面操作', 'success');
      } else {
        toast(response?.error || '启动失败', 'error');
      }
    } catch (_error) {
      toast('启动失败', 'error');
    } finally {
      setIsInjecting(false);
    }
  }, [isInjecting, toast]);

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
      title="Page Agent - AI 操作当前页面"
      aria-label="启动 Page Agent"
      data-testid="page-agent-button"
    >
      {isInjecting ? (
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      ) : (
        <PageAgentIcon />
      )}
    </button>
  );
}
