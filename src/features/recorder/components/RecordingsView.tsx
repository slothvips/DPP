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
    <div className="flex flex-col h-full gap-4">
      <RecorderControl />

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">录制列表 ({recordings?.length || 0})</h2>
        <div className="flex items-center gap-1">
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
            className="h-6 text-xs text-muted-foreground hover:text-foreground"
            onClick={handleImportClick}
          >
            <Upload className="w-3 h-3 mr-1" /> 导入
          </Button>
          {recordings && recordings.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs text-muted-foreground hover:text-destructive"
              onClick={async () => {
                const confirmed = await confirm('确定要删除所有录制吗?', '确认删除', 'danger');
                if (confirmed) {
                  clearRecordings();
                }
              }}
            >
              <Trash2 className="w-3 h-3 mr-1" /> 清空
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 pr-1">
        <RecordingsList
          recordings={recordings || []}
          onDelete={deleteRecording}
          onUpdateTitle={updateTitle}
          onExport={exportRecording}
        />
      </div>
    </div>
  );
}
