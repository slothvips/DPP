import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useRecorder } from '../hooks/useRecorder';

export function RecorderControl() {
  const { isRecording, duration, startRecording, isPageSupported, refetchPageSupport } =
    useRecorder();
  const { toast } = useToast();

  const handleStartRecording = async () => {
    const response = await startRecording();
    if (!response.success) {
      toast(response.error || '无法在该页面开始录制，请刷新页面后重试', 'error');
      // 重新检测页面支持状态
      refetchPageSupport();
    }
  };

  const isSupported = isPageSupported === true;
  const isChecking = isPageSupported === null;

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (!isRecording) {
    if (isChecking) {
      return (
        <Button variant="destructive" className="w-full flex items-center gap-2" disabled>
          <div className="w-3 h-3 rounded-full bg-white/50 animate-pulse" />
          检测页面...
        </Button>
      );
    }

    if (!isSupported) {
      return (
        <Button variant="outline" className="w-full flex items-center gap-2" disabled>
          <div className="w-3 h-3 rounded-full bg-muted-foreground" />
          页面不支持录制
        </Button>
      );
    }

    return (
      <Button
        variant="destructive"
        className="w-full flex items-center gap-2"
        onClick={handleStartRecording}
      >
        <div className="w-3 h-3 rounded-full bg-white" />
        开始录制
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
