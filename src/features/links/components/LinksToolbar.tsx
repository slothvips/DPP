import { Link2, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SortOption } from '@/features/links/hooks/useSortedFilteredLinks';

interface LinksToolbarProps {
  onAdd: () => void;
  onSearchChange: (value: string) => void;
  onSortChange: (value: SortOption) => void | Promise<void>;
  search: string;
  sortBy: SortOption;
}

export function LinksToolbar({
  onAdd,
  onSearchChange,
  onSortChange,
  search,
  sortBy,
}: LinksToolbarProps) {
  return (
    <div className="rounded-2xl border border-border/55 bg-primary/4 p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/9 text-primary ring-1 ring-primary/10">
            <Link2 className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-foreground">链接</h2>
            <p className="text-xs text-muted-foreground">整理常用地址与标签</p>
          </div>
        </div>
        <Button
          aria-label="添加链接"
          onClick={onAdd}
          size="sm"
          className="h-9 gap-1.5 rounded-xl bg-primary px-3 text-xs text-primary-foreground shadow-sm"
          title="添加链接"
        >
          <Plus className="h-4 w-4" />
          添加
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索链接..."
            className="h-9 rounded-xl border-border/60 bg-background/88 pl-9"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
        <Select value={sortBy} onValueChange={(value) => onSortChange(value as SortOption)}>
          <SelectTrigger className="h-9 w-[148px] shrink-0 rounded-xl border-border/60 bg-background/88 text-xs">
            <SelectValue placeholder="排序方式" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="createdAt" className="text-xs">
              按添加时间
            </SelectItem>
            <SelectItem value="updatedAt" className="text-xs">
              按更新时间
            </SelectItem>
            <SelectItem value="usageCount" className="text-xs">
              按使用次数
            </SelectItem>
            <SelectItem value="lastUsedAt" className="text-xs">
              按上次使用
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
