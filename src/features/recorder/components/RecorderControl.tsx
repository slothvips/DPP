import { Button } from '@/components/ui/button';
import { useRecorder } from '../hooks/useRecorder';

export function RecorderControl() {
  const { isRecording, duration, startRecording } = useRecorder();

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (!isRecording) {
    return (
      <Button
        variant="destructive"
        className="w-full flex items-center gap-2"
        onClick={startRecording}
      >
        <div className="w-3 h-3 rounded-full bg-white" />
        Start Recording
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-4 p-2 bg-background border rounded-md">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
        <span className="font-mono text-foreground font-medium">{formatDuration(duration)}</span>
      </div>
      <span className="ml-auto text-xs text-muted-foreground">在页面上停止</span>
    </div>
  );
}
