// AI Config Dialog - Settings for AI Assistant
import { Settings } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useAIConfigDialog } from '../hooks/useAIConfigDialog';
import { isAIConfigConfigured } from '../lib/aiConfigStorage';
import { AIConfigFormFields } from './AIConfigFormFields';
import { AIConfigProviderNotice } from './AIConfigProviderNotice';

interface AIConfigDialogProps {
  children?: React.ReactNode;
  onSaved?: () => void;
}

export function AIConfigDialog({ children, onSaved }: AIConfigDialogProps) {
  const [open, setOpen] = useState(false);
  const {
    provider,
    baseUrl,
    model,
    apiKey,
    loading,
    setBaseUrl,
    setModel,
    setApiKey,
    handleProviderChange,
    handleSave,
  } = useAIConfigDialog(open, onSaved);

  const handleSaveAndClose = async () => {
    const saved = await handleSave();
    if (saved) {
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="ghost" size="sm" title="AI 设置">
            <Settings className="w-4 h-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] border-border/60 bg-background/96">
        <DialogHeader>
          <DialogTitle>给 D仔 接入外置大脑</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-3">
          <AIConfigProviderNotice provider={provider} />

          <AIConfigFormFields
            provider={provider}
            baseUrl={baseUrl}
            model={model}
            apiKey={apiKey}
            onProviderChange={handleProviderChange}
            onBaseUrlChange={setBaseUrl}
            onModelChange={setModel}
            onApiKeyChange={setApiKey}
          />
        </div>
        <DialogFooter className="pt-1">
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button onClick={handleSaveAndClose} disabled={loading}>
            {loading ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { isAIConfigConfigured };
