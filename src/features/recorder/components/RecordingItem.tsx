import { format } from 'date-fns';
import { Download, Edit2, Play, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { logger } from '@/utils/logger';
import type { RecordingMeta } from '../types';

interface Props {
  recording: RecordingMeta;
  onDelete: (id: string) => void;
  onUpdateTitle: (id: string, title: string) => void;
  onExport: (recording: RecordingMeta) => void;
}

export function RecordingItem({ recording, onDelete, onUpdateTitle, onExport }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(recording.title);

  const handleSaveTitle = () => {
    if (title.trim() !== recording.title) {
      onUpdateTitle(recording.id, title);
    }
    setIsEditing(false);
  };

  const handlePlay = () => {
    const url = browser.runtime.getURL(`/player.html?id=${recording.id}`);
    browser.tabs.create({ url });
    // 如果在侧边栏中则关闭
    if (window.location.pathname.includes('sidepanel')) {
      window.close();
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDuration = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const rs = s % 60;
    return `${m}:${rs.toString().padStart(2, '0')}`;
  };

  const hostname = recording.url
    ? (() => {
        try {
          return new URL(recording.url).hostname;
        } catch (error) {
          logger.debug('Invalid URL:', recording.url, error);
          return recording.url;
        }
      })()
    : '-';

  return (
    <div className="group rounded-xl border border-border/60 bg-background/90 p-2 shadow-sm transition-all duration-200 hover:border-primary/10 hover:bg-muted/16 hover:shadow-sm">
      <div className="mb-1.5 flex items-start justify-between gap-2">
        {isEditing ? (
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleSaveTitle}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
            autoFocus
            className="h-7 rounded-xl text-sm"
          />
        ) : (
          <button
            type="button"
            className="min-w-0 flex-1 truncate py-0.5 text-left text-sm font-semibold text-foreground transition-colors hover:text-primary"
            title={`播放：${recording.title}`}
            onClick={handlePlay}
          >
            {recording.title}
          </button>
        )}
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={handlePlay}
            title="播放"
          >
            <Play className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => onExport(recording)}
            title="导出"
          >
            <Download className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => setIsEditing(!isEditing)}
            title="重命名"
          >
            <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 text-destructive hover:text-destructive"
            onClick={() => onDelete(recording.id)}
            title="删除"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex min-w-0 items-center gap-2">
          {recording.favicon && <img src={recording.favicon} className="h-3 w-3 shrink-0" alt="" />}
          <span className="truncate" title={recording.url}>
            {hostname}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span>{format(recording.createdAt, 'MM-dd HH:mm')}</span>
          <span>{formatDuration(recording.duration)}</span>
          <span>{formatSize(recording.fileSize)}</span>
        </div>
      </div>
    </div>
  );
}
