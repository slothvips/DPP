import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BlackboardAddButtonProps {
  onAdd: () => void | Promise<void>;
}

export function BlackboardAddButton({ onAdd }: BlackboardAddButtonProps) {
  return (
    <div className="absolute bottom-6 right-6">
      <Button
        aria-label="添加新便签"
        size="icon"
        className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-transform hover:scale-105 active:scale-95 bg-primary text-primary-foreground"
        onClick={onAdd}
        title="添加新便签"
      >
        <Plus className="w-6 h-6" />
      </Button>
    </div>
  );
}
