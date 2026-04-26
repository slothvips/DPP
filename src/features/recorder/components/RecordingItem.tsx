import { format } from 'date-fns';
import { Download, Edit2, Play, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { logger } from '@/utils/logger';
import type { Recording } from '../types';

interface Props {
  recording: Recording;
  onDelete: (id: string) => void;
  onUpdateTitle: (id: string, title: string) => void;
  onExport: (recording: Recording) => void;
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

  return (
    <div className="rounded-2xl border border-border/60 bg-background/92 p-3.5 text-card-foreground shadow-sm transition-all duration-200 hover:border-primary/10 hover:shadow-sm">
      <div className="mb-2.5 flex items-start justify-between gap-2">
        {isEditing ? (
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleSaveTitle}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
            autoFocus
            className="h-8 rounded-xl text-sm"
          />
        ) : (
          <div
            className="flex-1 truncate text-sm font-semibold text-foreground"
            title={recording.title}
          >
            {recording.title}
          </div>
        )}
        <div className="flex shrink-0 gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-xl"
            onClick={() => setIsEditing(!isEditing)}
            title="重命名"
          >
            <Edit2 className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-xl text-destructive hover:text-destructive"
            onClick={() => onDelete(recording.id)}
            title="删除"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>{format(recording.createdAt, 'yyyy-MM-dd HH:mm')}</span>
          <span>{formatDuration(recording.duration)}</span>
        </div>
        <div className="flex justify-between items-center">
          <div className="flex gap-2 items-center truncate max-w-[120px]">
            {recording.favicon && <img src={recording.favicon} className="w-3 h-3" alt="" />}
            <span className="truncate" title={recording.url}>
              {recording.url
                ? (() => {
                    try {
                      return new URL(recording.url).hostname;
                    } catch (error) {
                      logger.debug('Invalid URL:', recording.url, error);
                      return recording.url;
                    }
                  })()
                : '-'}
            </span>
          </div>
          <span>{formatSize(recording.fileSize)}</span>
        </div>
      </div>

      <div className="mt-3.5 flex gap-2">
        <Button size="sm" className="h-8 flex-1 text-xs shadow-sm" onClick={handlePlay}>
          <Play className="mr-1 h-3 w-3" /> 播放
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 flex-1 text-xs"
          onClick={() => onExport(recording)}
        >
          <Download className="mr-1 h-3 w-3" /> 导出
        </Button>
      </div>
    </div>
  );
}
