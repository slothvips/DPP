import { Plus } from 'lucide-react';

interface BlackboardAddButtonProps {
  onAdd: () => void | Promise<void>;
}

export function BlackboardAddButton({ onAdd }: BlackboardAddButtonProps) {
  return (
    <button
      aria-label="新建便签"
      className="group flex min-h-[172px] w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-primary/14 bg-primary/4 px-4 py-8 text-center transition-colors hover:border-primary/28 hover:bg-primary/7 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      onClick={() => {
        void onAdd();
      }}
      title="新建便签"
      type="button"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/12 transition-colors group-hover:bg-primary/14">
        <Plus className="h-5 w-5" />
      </span>
      <span className="text-sm font-semibold text-foreground">New</span>
    </button>
  );
}
