import { Plus, Trash2, X } from 'lucide-react';
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/components/ui/toast';
import type { TagItem } from '@/db/types';
import { VALIDATION_LIMITS } from '@/utils/validation';

interface TagSelectorProps {
  availableTags: TagItem[];
  selectedTagIds: Set<string>;
  onToggleTag: (tagId: string) => void;
  onCreateTag: (tagName: string) => Promise<void>;
  onDeleteTag: (tagId: string, tagName: string) => void;
}

export function TagSelector({
  availableTags,
  selectedTagIds,
  onToggleTag,
  onCreateTag,
  onDeleteTag,
}: TagSelectorProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');

  const handleCreate = async () => {
    if (!newTagName.trim()) return;
    try {
      await onCreateTag(newTagName.trim());
      setNewTagName('');
    } catch {
      toast('创建标签失败', 'error');
    }
  };

  const filteredTags = availableTags.filter((tag) =>
    tag.name.toLowerCase().includes(newTagName.trim().toLowerCase())
  );

  return (
    <div
      className="flex flex-wrap gap-1 items-center"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {/* Selected Tags Display */}
      {availableTags
        .filter((t) => selectedTagIds.has(t.id))
        .map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-info/10 text-info border border-info/20 max-w-[120px] truncate group/tag relative"
            title={tag.name}
          >
            <span className="truncate">{tag.name}</span>
            <button
              type="button"
              onClick={() => onToggleTag(tag.id)}
              className="ml-1 shrink-0 text-info hover:text-info-foreground hover:bg-info rounded-full p-0.5 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}

      {/* Add Button & Popover */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 rounded-full hover:bg-accent hover:text-accent-foreground"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          <div className="space-y-2">
            <div className="font-medium text-sm">选择标签</div>
            <div className="flex flex-wrap gap-1 max-h-60 overflow-y-auto content-start">
              {filteredTags.map((tag) => (
                <div
                  key={tag.id}
                  className={`flex items-center justify-between px-2 py-1 rounded text-xs border group/tag transition-colors cursor-default ${
                    selectedTagIds.has(tag.id)
                      ? 'bg-info/10 border-info/20 text-info'
                      : 'bg-background border-border hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onToggleTag(tag.id)}
                    className="flex-1 text-left outline-none truncate mr-1"
                    title={tag.name}
                  >
                    {tag.name}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteTag(tag.id, tag.name);
                    }}
                    className="ml-2 p-0.5 text-muted-foreground hover:text-destructive opacity-0 group-hover/tag:opacity-100 transition-opacity"
                    title="删除标签"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-2 border-t">
              <Input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="新建标签..."
                className="h-7 text-xs"
                maxLength={VALIDATION_LIMITS.TAG_NAME_MAX}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate();
                }}
              />
              <Button size="sm" className="h-7 px-2" onClick={handleCreate}>
                添加
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {newTagName.length} / {VALIDATION_LIMITS.TAG_NAME_MAX}
            </p>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
