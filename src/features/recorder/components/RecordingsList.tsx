import type { Recording } from '../types';
import { RecordingItem } from './RecordingItem';

interface Props {
  recordings: Recording[];
  onDelete: (id: string) => void;
  onUpdateTitle: (id: string, title: string) => void;
  onExport: (recording: Recording) => void;
}

export function RecordingsList({ recordings, onDelete, onUpdateTitle, onExport }: Props) {
  if (recordings.length === 0) {
    return <div className="text-center py-8 text-muted-foreground text-sm">No recordings yet.</div>;
  }

  return (
    <div className="space-y-3">
      {recordings.map((recording) => (
        <RecordingItem
          key={recording.id}
          recording={recording}
          onDelete={onDelete}
          onUpdateTitle={onUpdateTitle}
          onExport={onExport}
        />
      ))}
    </div>
  );
}
