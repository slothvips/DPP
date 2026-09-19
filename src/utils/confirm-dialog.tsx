import { type ReactNode, createContext, useCallback, useContext, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ConfirmDialogState {
  open: boolean;
  title: string;
  message: string;
  variant?: 'default' | 'danger';
}

interface ConfirmDialogContextValue {
  confirm: (message: string, title?: string, variant?: 'default' | 'danger') => Promise<boolean>;
}

const ConfirmDialogContext = createContext<ConfirmDialogContextValue | null>(null);

export function useConfirmDialog() {
  const context = useContext(ConfirmDialogContext);
  if (!context) {
    throw new Error('useConfirmDialog must be used within ConfirmDialogProvider');
  }
  return context;
}

interface ConfirmDialogProviderProps {
  children: ReactNode;
}

export function ConfirmDialogProvider({ children }: ConfirmDialogProviderProps) {
  const [state, setState] = useState<ConfirmDialogState>({
    open: false,
    title: '确认',
    message: '',
    variant: 'default',
  });
  const resolverRef = useRef<((confirmed: boolean) => void) | null>(null);

  const confirm = useCallback(
    (
      message: string,
      title: string = '确认',
      variant: 'default' | 'danger' = 'default'
    ): Promise<boolean> => {
      // 前一次未应答的确认按"取消"结算,避免调用方 Promise 永久悬挂
      resolverRef.current?.(false);
      return new Promise((resolve) => {
        resolverRef.current = resolve;
        setState({ open: true, title, message, variant });
      });
    },
    []
  );

  const settle = (confirmed: boolean) => {
    resolverRef.current?.(confirmed);
    resolverRef.current = null;
    setState((prev) => ({ ...prev, open: false }));
  };

  const handleConfirm = () => settle(true);
  const handleCancel = () => settle(false);

  return (
    <ConfirmDialogContext.Provider value={{ confirm }}>
      {children}
      <Dialog open={state.open} onOpenChange={(open) => !open && handleCancel()}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{state.title}</DialogTitle>
            <DialogDescription style={{ whiteSpace: 'pre-line' }}>
              {state.message}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              取消
            </Button>
            <Button
              variant={state.variant === 'danger' ? 'destructive' : 'default'}
              onClick={handleConfirm}
            >
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmDialogContext.Provider>
  );
}
