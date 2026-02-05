import { browser } from 'wxt/browser';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { logger } from '@/utils/logger';
import { useRecorder } from '../hooks/useRecorder';

export function RecorderControl() {
  const { isRecording, duration, startRecording } = useRecorder();
  const { toast } = useToast();

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
      <div className="flex flex-col gap-2 w-full">
        <Button
          variant="destructive"
          className="w-full flex items-center gap-2"
          onClick={startRecording}
        >
          <div className="w-3 h-3 rounded-full bg-white" />
          Start Recording
        </Button>
        <Button
          variant="outline"
          className="w-full flex items-center justify-center gap-2"
          onClick={async () => {
            try {
              const response = await browser.runtime.sendMessage({
                type: 'RECORDER_REQUEST_STREAM',
              });
              if (!response.success) {
                toast(response.error || 'Unknown error', 'error');
              }
            } catch (e) {
              logger.error('Failed to request recording stream:', e);
              toast('Failed to request screen sharing', 'error');
            }
          }}
        >
          Screen Share (Offscreen)
        </Button>
      </div>
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
