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
    <div className="p-3 border rounded-lg bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2 mb-2">
        {isEditing ? (
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleSaveTitle}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
            autoFocus
            className="h-7 text-sm"
          />
        ) : (
          <div className="font-medium text-sm truncate flex-1" title={recording.title}>
            {recording.title}
          </div>
        )}
        <div className="flex gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setIsEditing(!isEditing)}
            title="重命名"
          >
            <Edit2 className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive hover:text-destructive"
            onClick={() => onDelete(recording.id)}
            title="删除"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>

      <div className="text-xs text-muted-foreground flex flex-col gap-1">
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

      <div className="flex gap-2 mt-3">
        <Button size="sm" className="flex-1 h-7 text-xs" onClick={handlePlay}>
          <Play className="w-3 h-3 mr-1" /> 播放
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1 h-7 text-xs"
          onClick={() => onExport(recording)}
        >
          <Download className="w-3 h-3 mr-1" /> 导出
        </Button>
      </div>
    </div>
  );
}
