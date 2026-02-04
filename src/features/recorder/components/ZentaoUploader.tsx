import { format } from 'date-fns';
import { Film, Upload, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { Recording } from '../types';

// Simple Modal Component to stay inside Shadow DOM and avoid Portal issues
function SimpleModal({
  onClose,
  onSelect,
  recordings,
}: {
  onClose: () => void;
  onSelect: (r: Recording) => void;
  recordings: Recording[];
}) {
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-[500px] max-h-[80vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="font-semibold text-lg text-foreground">选择录像</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded text-muted-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {recordings.map((rec) => (
            <button
              type="button"
              key={rec.id}
              className="w-full text-left p-3 border rounded hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer flex items-center gap-3 transition-colors group"
              onClick={() => onSelect(rec)}
            >
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded flex items-center justify-center shrink-0">
                <Film className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate text-foreground">{rec.title}</div>
                <div className="text-xs text-muted-foreground">
                  {format(rec.createdAt, 'MM-dd HH:mm')} · {Math.round(rec.duration / 1000)}s
                </div>
              </div>
              <Upload className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </button>
          ))}
          {recordings.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">暂无录像</div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ZentaoUploader({ targetInput }: { targetInput: HTMLInputElement }) {
  const [showModal, setShowModal] = useState(false);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(false);

  const loadRecordings = async () => {
    setLoading(true);
    try {
      const res = await browser.runtime.sendMessage({ type: 'RECORDER_GET_ALL_RECORDINGS' });
      if (res.success) {
        setRecordings(res.recordings || []);
        setShowModal(true);
      } else {
        console.error('Failed to load recordings:', res.error);
        alert('无法加载录像列表');
      }
    } catch (e) {
      console.error('Error loading recordings:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (recording: Recording) => {
    const safeTitle = recording.title.replace(/[^a-z0-9\u4e00-\u9fa5]/gi, '_');
    const filename = `${safeTitle}.rrweb.json`;
    const blob = new Blob([JSON.stringify(recording.events)], { type: 'application/json' });
    const file = new File([blob], filename, { type: 'application/json' });

    const dt = new DataTransfer();
    dt.items.add(file);

    targetInput.files = dt.files;
    targetInput.dispatchEvent(new Event('change', { bubbles: true }));

    setShowModal(false);
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={loadRecordings}
        disabled={loading}
        className="ml-2 gap-1 text-xs h-7 px-2 border-dashed border-primary/50 hover:border-primary text-primary hover:bg-primary/5"
        style={{ verticalAlign: 'middle' }}
      >
        <Film className="w-3 h-3" />
        {loading ? '加载中...' : '上传录像'}
      </Button>
      {showModal && (
        <SimpleModal
          recordings={recordings}
          onClose={() => setShowModal(false)}
          onSelect={handleSelect}
        />
      )}
    </>
  );
}
