import { Check, ChevronUp, Copy, Sparkles } from 'lucide-react';
import remarkGfm from 'remark-gfm';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';

interface DiffAiPanelProps {
  aiError: string | null;
  aiLoading: boolean;
  aiSummary: string | null;
  copied: boolean;
  onClose: () => void;
  onCopy: () => void;
}

export function DiffAiPanel({
  aiError,
  aiLoading,
  aiSummary,
  copied,
  onClose,
  onCopy,
}: DiffAiPanelProps) {
  return (
    <div className="border-b border-border bg-muted/30">
      <button
        onClick={onClose}
        className="flex items-center justify-between w-full px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          AI 解读
        </span>
        <ChevronUp className="h-4 w-4" />
      </button>
      <div className="px-4 pb-4 max-h-48 overflow-y-auto">
        {aiLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            正在解读差异...
          </div>
        )}
        {aiError && <div className="text-sm text-destructive">{aiError}</div>}
        {aiSummary && (
          <div className="relative group">
            <div className="text-sm text-foreground [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-0.5 [&_p]:m-0">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiSummary}</ReactMarkdown>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
              onClick={onCopy}
              title="复制"
            >
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        )}
        {!aiLoading && !aiError && !aiSummary && (
          <div className="text-sm text-muted-foreground">点击 Sparkles 图标获取 AI 解读</div>
        )}
      </div>
    </div>
  );
}
