import { AlertTriangle, BookOpen, LoaderCircle, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { Button } from '@/components/ui/button';
import { ToastProvider, useToast } from '@/components/ui/toast';
import { syncEngine } from '@/db';
import { ConversationMaterialDetail } from '@/features/aiAssistant/components/ConversationMaterialLibraryView';
import { AI_CURRENT_SESSION_STORAGE_KEY } from '@/features/aiAssistant/hooks/useAIChatSessions.shared';
import { createConversationMaterialDeepLink } from '@/features/aiAssistant/materials/materialDeepLink';
import type { DecryptedConversationMaterial } from '@/features/aiAssistant/materials/testCaseTypes';
import { createSessionFromConversation, getConversationMaterial } from '@/lib/db/conversations';
import { logger } from '@/utils/logger';

type PreviewStatus = 'loading' | 'ready' | 'missing' | 'invalid' | 'error';

export function MaterialPreviewApp() {
  return (
    <ToastProvider>
      <MaterialPreviewContent />
    </ToastProvider>
  );
}

function MaterialPreviewContent() {
  const materialId = new URLSearchParams(window.location.search).get('materialId')?.trim() ?? '';
  const [material, setMaterial] = useState<DecryptedConversationMaterial | undefined>();
  const [status, setStatus] = useState<PreviewStatus>(materialId ? 'loading' : 'invalid');
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [using, setUsing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!materialId) return;

    let cancelled = false;
    setStatus('loading');
    setError(null);

    const loadMaterial = async () => {
      try {
        let loaded = await getConversationMaterial(materialId);
        if (!loaded) {
          try {
            await syncEngine.pull();
          } catch (syncError) {
            logger.error('[MaterialPreview] Failed to sync material:', syncError);
            if (!cancelled) {
              setStatus('error');
              setError('无法同步共享会话，请检查网络和团队同步配置。');
            }
            return;
          }
          loaded = await getConversationMaterial(materialId);
        }

        if (cancelled) return;
        if (!loaded) {
          setStatus('missing');
          return;
        }
        setMaterial(loaded);
        setStatus('ready');
      } catch (loadError) {
        logger.error('[MaterialPreview] Failed to load material:', loadError);
        if (!cancelled) {
          setStatus('error');
          setError('无法解密会话内容，请检查团队加密密钥。');
        }
      }
    };

    void loadMaterial();
    return () => {
      cancelled = true;
    };
  }, [materialId, reloadKey]);

  const handleUse = async () => {
    if (!material || using) return;
    setUsing(true);
    const sidePanelOpen = openSidePanelForCurrentTab().catch((openError) => {
      logger.warn('[MaterialPreview] Direct side panel open failed:', openError);
    });
    try {
      const session = await createSessionFromConversation(material);
      await browser.storage.session.set({ [AI_CURRENT_SESSION_STORAGE_KEY]: session.id });
      await sidePanelOpen;
      await browser.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' }).catch((openError) => {
        logger.warn('[MaterialPreview] Background side panel fallback failed:', openError);
      });
      toast('已带到我的会话', 'success');
    } catch (useError) {
      logger.error('[MaterialPreview] Failed to import material:', useError);
      toast('导入会话失败，请重试', 'error');
    } finally {
      setUsing(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(createConversationMaterialDeepLink(materialId));
      toast('DPP 链接已复制', 'success');
    } catch (copyError) {
      logger.warn('[MaterialPreview] Failed to copy material link:', copyError);
      toast('复制链接失败，请重试', 'error');
    }
  };

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-8 sm:py-10">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-6 flex items-center gap-3 border-b border-border/60 pb-4">
          <BookOpen className="h-5 w-5 text-primary" />
          <div className="min-w-0">
            <h1 className="text-base font-semibold">DPP 共享会话</h1>
            <p className="mt-1 text-xs text-muted-foreground">只读查看永久共享的完整会话内容</p>
          </div>
        </header>

        {status === 'ready' && material ? (
          <ConversationMaterialDetail
            material={material}
            using={using}
            onUse={() => void handleUse()}
            onCopyLink={() => void handleCopyLink()}
            showBack={false}
          />
        ) : (
          <PreviewState
            status={status}
            error={error}
            onRetry={() => setReloadKey((value) => value + 1)}
          />
        )}
      </div>
    </main>
  );
}

async function openSidePanelForCurrentTab(): Promise<void> {
  const currentTab = await browser.tabs.getCurrent();
  if (typeof currentTab?.id !== 'number') {
    throw new Error('无法确定当前预览标签页');
  }
  await browser.sidePanel.open({ tabId: currentTab.id });
}

function PreviewState({
  status,
  error,
  onRetry,
}: {
  status: PreviewStatus;
  error: string | null;
  onRetry: () => void;
}) {
  if (status === 'loading') {
    return (
      <div className="flex min-h-48 items-center justify-center">
        <LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const title =
    status === 'invalid'
      ? '共享链接无效'
      : status === 'missing'
        ? '找不到共享会话'
        : '共享会话不可用';
  const description =
    status === 'invalid'
      ? '请使用 DPP 物料库复制的完整链接。'
      : status === 'missing'
        ? '物料可能尚未同步，或已经不再可用。'
        : error || '请稍后重试。';

  return (
    <div className="flex min-h-48 items-center justify-center rounded-xl border border-border/60 bg-card p-6">
      <div className="max-w-md text-center">
        <AlertTriangle className="mx-auto h-7 w-7 text-warning" />
        <h2 className="mt-3 text-sm font-semibold">{title}</h2>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">{description}</p>
        {status !== 'invalid' && (
          <Button variant="outline" size="sm" onClick={onRetry} className="mt-4 gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            重试
          </Button>
        )}
      </div>
    </div>
  );
}
