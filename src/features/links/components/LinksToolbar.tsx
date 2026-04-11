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
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="搜索链接..."
          className="pl-8 h-8"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>
      <Select value={sortBy} onValueChange={(value) => onSortChange(value as SortOption)}>
        <SelectTrigger className="w-[140px] shrink-0 h-8 text-xs">
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
        className="shrink-0 h-8 w-8 p-0"
        title="添加链接"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
