import { X } from 'lucide-react';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
}

const TOAST_DURATION_MS = 3000;

const ToastContext = createContext<ToastContextType | undefined>(undefined);

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const remainingRef = useRef(TOAST_DURATION_MS);
  const startedAtRef = useRef(Date.now());
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    timerRef.current = window.setTimeout(() => onRemove(toast.id), remainingRef.current);
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, [toast.id, onRemove]);

  const pauseTimer = () => {
    if (timerRef.current === null) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
    remainingRef.current -= Date.now() - startedAtRef.current;
  };

  const resumeTimer = () => {
    if (timerRef.current !== null) return;
    startedAtRef.current = Date.now();
    timerRef.current = window.setTimeout(() => onRemove(toast.id), remainingRef.current);
  };

  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
      onMouseEnter={pauseTimer}
      onMouseLeave={resumeTimer}
      className={`
        pointer-events-auto flex items-center justify-between gap-2 px-4 py-3 rounded-md shadow-lg text-sm font-medium transition-all mx-auto w-full max-w-sm border border-border bg-card text-card-foreground
        ${toast.type === 'success' ? 'bg-success text-success-foreground' : ''}
        ${toast.type === 'error' ? 'bg-destructive text-destructive-foreground' : ''}
        ${toast.type === 'info' ? 'bg-card text-card-foreground border-border shadow-md' : ''}
      `}
    >
      <span className="flex-1 break-words">{toast.message}</span>
      <button
        type="button"
        aria-label="关闭通知"
        onClick={() => onRemove(toast.id)}
        className="opacity-70 hover:opacity-100 transition-opacity p-1 shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = (message: string, type: ToastType = 'info') => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      <div className="flex h-full min-h-0 flex-col overflow-hidden">{children}</div>
      <div className="fixed top-4 left-4 right-4 z-[2147483647] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
