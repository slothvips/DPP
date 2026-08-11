import { Trash2, Upload } from 'lucide-react';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useConfirmDialog } from '@/utils/confirm-dialog';
import { logger } from '@/utils/logger';
import { useRecordings } from '../hooks/useRecordings';
import type { RecordingMeta } from '../types';
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

  async function handleClearAll() {
    const confirmed = await confirm('确定要删除所有录制吗?', '确认删除', 'danger');
    if (!confirmed) return;

    try {
      await clearRecordings();
    } catch (error) {
      logger.error('Failed to clear recordings:', error);
      toast('清空录制失败', 'error');
    }
  }

  async function handleDelete(id: string) {
    const confirmed = await confirm('确定要删除这条录制吗?', '确认删除', 'danger');
    if (!confirmed) return;

    try {
      await deleteRecording(id);
    } catch (error) {
      logger.error('Failed to delete recording:', error);
      toast('删除录制失败', 'error');
    }
  }

  async function handleUpdateTitle(id: string, title: string) {
    try {
      await updateTitle(id, title);
    } catch (error) {
      logger.error('Failed to update recording title:', error);
      toast('重命名失败', 'error');
    }
  }

  async function handleExport(recording: RecordingMeta) {
    try {
      await exportRecording(recording);
    } catch (error) {
      logger.error('Failed to export recording:', error);
      toast(error instanceof Error ? `导出失败: ${error.message}` : '导出失败: 未知错误', 'error');
    }
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-3 overflow-hidden p-3 [@media(max-height:520px)]:gap-2 [@media(max-height:520px)]:p-2 sm:gap-4 sm:p-4">
      <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-2xl border border-border/55 bg-primary/4 p-2.5 [@media(max-height:520px)]:p-2">
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept=".json,.rrweb"
          onChange={(event) => void handleFileChange(event)}
        />
        <div className="min-w-[160px] flex-1">
          <RecorderControl />
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 shrink-0 rounded-xl border border-border/60 bg-background/88 px-3 text-xs text-muted-foreground hover:text-foreground"
          onClick={handleImportClick}
        >
          <Upload className="mr-1 h-3.5 w-3.5" /> 导入
        </Button>
        {recordings && recordings.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 shrink-0 rounded-xl px-3 text-xs text-muted-foreground hover:text-destructive"
            onClick={() => void handleClearAll()}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" /> 清空
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <RecordingsList
          recordings={recordings || []}
          onDelete={(id) => void handleDelete(id)}
          onUpdateTitle={(id, title) => void handleUpdateTitle(id, title)}
          onExport={(recording) => void handleExport(recording)}
        />
      </div>
    </div>
  );
}
