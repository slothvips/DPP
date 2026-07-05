import { Plus, Search } from 'lucide-react';
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
    <div className="rounded-2xl border border-border/55 bg-primary/4 p-2.5 [@media(max-height:520px)]:p-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[150px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索链接..."
            className="h-9 rounded-xl border-border/60 bg-background/88 pl-9"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
        <Select value={sortBy} onValueChange={(value) => onSortChange(value as SortOption)}>
          <SelectTrigger className="h-9 w-[136px] shrink-0 rounded-xl border-border/60 bg-background/88 text-xs">
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
        <Button
          aria-label="添加链接"
          onClick={onAdd}
          size="sm"
          className="h-9 shrink-0 gap-1.5 rounded-xl bg-primary px-3 text-xs text-primary-foreground shadow-sm"
          title="添加链接"
        >
          <Plus className="h-4 w-4" />
          添加
        </Button>
      </div>
    </div>
  );
}
