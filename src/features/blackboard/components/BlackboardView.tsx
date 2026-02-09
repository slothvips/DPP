import { useLiveQuery } from 'dexie-react-hooks';
import { Plus } from 'lucide-react';
import Masonry from 'masonry-layout';
import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { db } from '@/db';
import type { BlackboardItem } from '../types';
import { BlackboardItemView } from './BlackboardItem';

const STICKY_COLORS = [
  'bg-yellow-100 dark:bg-yellow-900/20',
  'bg-blue-100 dark:bg-blue-900/20',
  'bg-green-100 dark:bg-green-900/20',
  'bg-pink-100 dark:bg-pink-900/20',
  'bg-purple-100 dark:bg-purple-900/20',
  'bg-orange-100 dark:bg-orange-900/20',
];

const SYSTEM_NOTES: BlackboardItem[] = [
  {
    id: 'system-welcome',
    content: `# 👋 欢迎使用团队黑板\n\n这是一个团队共享的**实时便签墙**。\n\n你在这里写的每一张便签，团队成员都能实时看到。\n\n用它来记录：\n- 每日站会重点\n- 临时的技术想法\n- 共享的测试账号\n- 甚至是午餐投票！`,
    createdAt: 0,
    updatedAt: 0,
    pinned: false,
  },
  {
    id: 'system-markdown',
    content: `# 📝 Markdown 指南\n\n点击便签即可**查看源码**，支持标准 Markdown 语法：\n\n- **加粗**: \`**text**\`\n- *斜体*: \`*text*\`\n- 列表: \`- item\`\n- 引用: \`> text\`\n- 代码: \`\` \`code\` \`\`\n\n还有待办事项：\n- [ ] 这是一个任务\n- [x] 已完成的任务`,
    createdAt: 0,
    updatedAt: 0,
    pinned: false,
  },
  {
    id: 'system-tips',
    content: `# 💡 使用小贴士\n\n1. **源码模式**：点击便签进入编辑模式，可以看到 Markdown 源码。\n2. **实时预览**：点击空白处，源码会自动渲染成漂亮的格式。\n3. **自动布局**：便签会根据内容高度自动调整位置，无需手动整理。\n4. **置顶**：点击右上角的图钉 📌 可以将重要便签固定在前面。`,
    createdAt: 0,
    updatedAt: 0,
    pinned: false,
  },
];

export function BlackboardView() {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const masonryRef = useRef<Masonry | null>(null);

  const items = useLiveQuery(async () => {
    return await db.blackboard.orderBy('createdAt').reverse().toArray();
  });

  const handleAdd = async () => {
    const now = Date.now();
    const newId = crypto.randomUUID();
    setFocusId(newId);
    await db.blackboard.add({
      id: newId,
      content: '', // Start empty
      createdAt: now,
      updatedAt: now,
      pinned: false,
    });
  };

  const handleUpdate = async (id: string, content: string) => {
    await db.blackboard.update(id, {
      content,
      updatedAt: Date.now(),
    });
  };

  const confirmDelete = async () => {
    if (deleteId) {
      await db.blackboard.delete(deleteId);
      setDeleteId(null);
    }
  };

  const handlePin = async (id: string, pinned: boolean) => {
    await db.blackboard.update(id, {
      pinned,
      updatedAt: Date.now(),
    });
  };

  // Sort: pinned first, then by createdAt desc
  const sortedItems = [...SYSTEM_NOTES, ...(items || [])].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.createdAt - a.createdAt;
  });

  // Initialize Masonry
  useEffect(() => {
    if (gridRef.current && !masonryRef.current) {
      masonryRef.current = new Masonry(gridRef.current, {
        itemSelector: '.grid-item',
        columnWidth: '.grid-sizer',
        percentPosition: true,
        gutter: 24, // 1.5rem / gap-6
        transitionDuration: '0.2s', // Smooth re-layout
      });
    }

    // Cleanup
    return () => {
      masonryRef.current?.destroy();
      masonryRef.current = null;
    };
  }, []);

  // Update layout when items change
  useEffect(() => {
    if (masonryRef.current) {
      masonryRef.current.reloadItems();
      masonryRef.current.layout();
    }
  }, [sortedItems]);

  const handleResize = () => {
    masonryRef.current?.layout();
  };

  // Assign consistent colors based on ID hash
  const getItemColor = (id: string) => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % STICKY_COLORS.length;
    return STICKY_COLORS[index];
  };

  return (
    <div className="flex flex-col h-full bg-stone-100 dark:bg-stone-900 relative bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+')]">
      <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
        {/* Empty State */}
        {sortedItems?.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50">
            <div className="border-2 border-dashed border-current rounded-lg p-8 mb-4">
              <Plus className="w-12 h-12" />
            </div>
            <p className="text-lg font-medium">黑板上空空如也</p>
            <p className="text-sm">点击右下角添加第一张便签</p>
          </div>
        )}

        {/* Masonry Layout Container */}
        <div ref={gridRef} className="max-w-5xl mx-auto pb-24">
          {/* Grid sizer for column width calculation */}
          <div className="grid-sizer w-full md:w-[calc(50%-12px)]" />

          {sortedItems?.map((item) => (
            <div key={item.id} className="grid-item w-full md:w-[calc(50%-12px)] mb-6">
              <BlackboardItemView
                item={item}
                onUpdate={handleUpdate}
                onDelete={async (id) => setDeleteId(id)}
                onPin={handlePin}
                onResize={handleResize}
                color={getItemColor(item.id)}
                readOnly={item.id.startsWith('system-')}
                isFocused={item.id === focusId}
                onFocusHandled={() => setFocusId(null)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Floating Action Button */}
      <div className="absolute bottom-6 right-6">
        <Button
          size="icon"
          className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-transform hover:scale-105 active:scale-95 bg-primary text-primary-foreground"
          onClick={handleAdd}
          title="添加新便签"
        >
          <Plus className="w-6 h-6" />
        </Button>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除便签</DialogTitle>
            <DialogDescription>确定要撕掉这张便签吗？此操作无法撤销。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
