// AI Config Dialog - Settings for AI Assistant
import { Settings } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { db } from '@/db';
import { DEFAULT_OLLAMA_BASE_URL, DEFAULT_OLLAMA_MODEL, OllamaProvider } from '@/lib/ai/ollama';
import { logger } from '@/utils/logger';

interface AIConfigDialogProps {
  children?: React.ReactNode;
  onSaved?: () => void;
}

export function AIConfigDialog({ children, onSaved }: AIConfigDialogProps) {
  const [open, setOpen] = useState(false);
  const [baseUrl, setBaseUrl] = useState(DEFAULT_OLLAMA_BASE_URL);
  const [model, setModel] = useState(DEFAULT_OLLAMA_MODEL);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Load existing config when dialog opens
  useEffect(() => {
    if (open) {
      loadConfig();
    }
  }, [open]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const baseUrlSetting = await db.settings.where('key').equals('ai_ollama_base_url').first();
      const modelSetting = await db.settings.where('key').equals('ai_ollama_model').first();

      const savedBaseUrl = (baseUrlSetting?.value as string) || DEFAULT_OLLAMA_BASE_URL;
      const savedModel = (modelSetting?.value as string) || DEFAULT_OLLAMA_MODEL;

      setBaseUrl(savedBaseUrl);
      setModel(savedModel);

      // Fetch available models
      try {
        const provider = new OllamaProvider(savedBaseUrl);
        const models = await provider.listModels();
        setAvailableModels(models.map((m) => m.name));

        // If current model is not in list, add it
        if (savedModel && !models.find((m) => m.name === savedModel)) {
          setAvailableModels((prev) => [savedModel, ...prev]);
        }
      } catch (err) {
        logger.error('[AIConfig] Failed to fetch models:', err);
        // Still allow manual input
        setAvailableModels([savedModel]);
      }
    } catch (err) {
      logger.error('[AIConfig] Failed to load config:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await db.settings.put({ key: 'ai_ollama_base_url', value: baseUrl });
      await db.settings.put({ key: 'ai_ollama_model', value: model });
      setOpen(false);
      onSaved?.();
    } catch (err) {
      logger.error('[AIConfig] Failed to save config:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus('idle');
    try {
      const provider = new OllamaProvider(baseUrl);
      const connected = await provider.healthCheck();
      setConnectionStatus(connected ? 'success' : 'error');
    } catch {
      setConnectionStatus('error');
    } finally {
      setTestingConnection(false);
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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>AI 设置</DialogTitle>
          <DialogDescription>配置 Ollama 服务连接信息</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="ai-base-url">服务地址</Label>
            <Input
              id="ai-base-url"
              value={baseUrl}
              onChange={(e) => {
                setBaseUrl(e.target.value);
                setConnectionStatus('idle');
              }}
              placeholder="http://localhost:11434"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ai-model">模型</Label>
            <Select
              value={model}
              onValueChange={setModel}
              disabled={availableModels.length === 0 && !loading}
            >
              <SelectTrigger id="ai-model">
                <SelectValue placeholder="选择模型" />
              </SelectTrigger>
              <SelectContent>
                {availableModels.length > 0 ? (
                  availableModels.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value={model}>{model}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={testingConnection}
            >
              {testingConnection ? '测试中...' : '测试连接'}
            </Button>
            {connectionStatus === 'success' && (
              <span className="text-sm text-green-500">连接成功</span>
            )}
            {connectionStatus === 'error' && <span className="text-sm text-red-500">连接失败</span>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Check if AI config is configured (has values in settings)
 */
export async function isAIConfigConfigured(): Promise<boolean> {
  const baseUrlSetting = await db.settings.where('key').equals('ai_ollama_base_url').first();
  const modelSetting = await db.settings.where('key').equals('ai_ollama_model').first();
  return !!(baseUrlSetting?.value || modelSetting?.value);
}
