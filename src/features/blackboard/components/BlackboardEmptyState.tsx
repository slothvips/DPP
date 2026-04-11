import { Plus } from 'lucide-react';

export function BlackboardEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
      <div className="border-2 border-dashed border-current rounded-lg p-8 mb-4">
        <Plus className="w-12 h-12" />
      </div>
      <p className="text-lg font-medium">黑板上空空如也</p>
      <p className="text-sm">点击右下角添加第一张便签</p>
    </div>
  );
}
