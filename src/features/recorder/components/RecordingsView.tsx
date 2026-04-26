import { Trash2, Upload } from 'lucide-react';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useConfirmDialog } from '@/utils/confirm-dialog';
import { useRecordings } from '../hooks/useRecordings';
import { RecorderControl } from './RecorderControl';
import { RecordingsList } from './RecordingsList';

export function RecordingsView() {
  const {
    recordings,
    deleteRecording,
    updateTitle,
    exportRecording,
    clearRecordings,
    importRecording,
  } = useRecordings();
  const { toast } = useToast();
  const { confirm } = useConfirmDialog();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await importRecording(file);
      toast('录制导入成功', 'success');
    } catch (error) {
      toast(error instanceof Error ? `导入失败: ${error.message}` : '导入失败: 未知错误', 'error');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="rounded-2xl border border-border/60 bg-destructive/5 p-3 ring-1 ring-destructive/6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-foreground">录制</h2>
            <p className="text-xs text-muted-foreground">捕获页面操作并回放关键流程</p>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".json,.rrweb"
              onChange={handleFileChange}
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-8 rounded-xl border border-destructive/15 bg-background/80 px-3 text-xs text-destructive shadow-sm hover:text-destructive"
              onClick={handleImportClick}
            >
              <Upload className="mr-1 h-3.5 w-3.5" /> 导入
            </Button>
            {recordings && recordings.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-xl px-3 text-xs text-muted-foreground hover:text-destructive"
                onClick={async () => {
                  const confirmed = await confirm('确定要删除所有录制吗?', '确认删除', 'danger');
                  if (confirmed) {
                    clearRecordings();
                  }
                }}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" /> 清空
              </Button>
            )}
          </div>
        </div>
        <RecorderControl />
      </div>

      <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-border/60 bg-background/84 p-3">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">
            录制列表 ({recordings?.length || 0})
          </h3>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <RecordingsList
            recordings={recordings || []}
            onDelete={async (id) => {
              const confirmed = await confirm('确定要删除这条录制吗?', '确认删除', 'danger');
              if (confirmed) {
                deleteRecording(id);
              }
            }}
            onUpdateTitle={updateTitle}
            onExport={exportRecording}
          />
        </div>
      </div>
    </div>
  );
}
