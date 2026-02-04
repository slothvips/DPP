import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRecordings } from '../hooks/useRecordings';
import { RecorderControl } from './RecorderControl';
import { RecordingsList } from './RecordingsList';

export function RecordingsView() {
  const { recordings, deleteRecording, updateTitle, exportRecording, clearRecordings } =
    useRecordings();

  return (
    <div className="flex flex-col h-full gap-4">
      <RecorderControl />

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Recordings ({recordings?.length || 0})</h2>
        {recordings && recordings.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs text-muted-foreground hover:text-destructive"
            onClick={() => {
              if (confirm('Are you sure you want to delete all recordings?')) {
                clearRecordings();
              }
            }}
          >
            <Trash2 className="w-3 h-3 mr-1" /> Clear All
          </Button>
        )}
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
