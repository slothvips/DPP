import { Play } from 'lucide-react';
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
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-destructive/14 bg-destructive/4 px-4 py-8 text-center">
        <div>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive ring-1 ring-destructive/12">
            <Play className="h-5 w-5" />
          </div>
          <p className="text-sm font-semibold text-foreground">暂无录制记录</p>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            点击上方开始录制，记录页面操作并回放。
          </p>
        </div>
      </div>
    );
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
