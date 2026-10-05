import { ArrowLeft, Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { createTestProject } from '@/lib/db';
import { logger } from '@/utils/logger';
import { EditorField } from './materialLibraryShared';

export function TestProjectCreator({
  embedded = false,
  onCancel,
  onCreated,
}: {
  embedded?: boolean;
  onCancel: () => void;
  onCreated: (projectId: string) => void;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const project = await createTestProject({ title, description });
      toast('测试项目已创建，请继续填写测试用例', 'success');
      onCreated(project.id);
    } catch (error) {
      logger.error('[MaterialLibrary] Failed to create test project:', error);
      toast(error instanceof Error ? error.message : '创建测试项目失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={embedded ? 'p-4' : 'min-h-0 flex-1 overflow-y-auto p-4'}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={saving}
          className="h-8 gap-1.5 rounded-lg px-2 text-xs"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          返回项目列表
        </Button>
        <span className="text-[11px] text-muted-foreground">第一步：创建测试项目</span>
      </div>
      <div className="space-y-4">
        <EditorField label="项目名称">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="例如：电商网站回归测试"
          />
        </EditorField>
        <EditorField label="项目描述">
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="描述这个项目覆盖的测试范围（可选）"
          />
        </EditorField>
        <div className="flex justify-end gap-2 border-t border-border/50 pt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={saving}
            className="h-8 rounded-lg text-xs"
          >
            取消
          </Button>
          <Button
            size="sm"
            onClick={() => void handleSave()}
            disabled={saving}
            className="h-8 gap-1.5 rounded-lg text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            {saving ? '创建中...' : '创建项目并继续'}
          </Button>
        </div>
      </div>
    </div>
  );
}
