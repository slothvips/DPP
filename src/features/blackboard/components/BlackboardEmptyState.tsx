import { Plus } from 'lucide-react';

export function BlackboardEmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-4 text-center text-muted-foreground">
      <div className="rounded-3xl border border-border/60 bg-background/80 px-8 py-8 backdrop-blur-sm">
        <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-[28px] border border-dashed border-border/80 bg-background/75 shadow-sm">
          <Plus className="h-10 w-10" />
        </div>
        <p className="text-base font-semibold text-foreground">黑板上空空如也</p>
        <p className="mt-2 max-w-xs text-sm leading-6">点击右下角添加第一张便签，记下想法和待办</p>
      </div>
    </div>
  );
}
