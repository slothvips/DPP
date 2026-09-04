import { useEffect } from 'react';
import { browser } from 'wxt/browser';
import { ToastProvider } from '@/components/ui/toast';
import { useTheme } from '@/hooks/useTheme';
import { BROWSER_TASK_HOST_PORT_NAME } from '@/lib/browserTask/types';
import { ConfirmDialogProvider } from '@/utils/confirm-dialog';
import { SidepanelContent } from './SidepanelContent';
import { useSidepanelAutoPull } from './useSidepanelAutoPull';
import { useSidepanelSettings } from './useSidepanelSettings';
import { useSidepanelTabs } from './useSidepanelTabs';

export function App() {
  useTheme();
  useSidepanelAutoPull();

  useEffect(() => {
    const port = browser.runtime.connect({ name: BROWSER_TASK_HOST_PORT_NAME });
    return () => port.disconnect();
  }, []);

  const { featureToggles, settingsReady, isMinimalMode, showSyncButton } = useSidepanelSettings();
  const { activeTab, handleTabChange, recentTabs } = useSidepanelTabs({ featureToggles });
  useEffect(() => {
    const handleOpenAISession = () => handleTabChange('aiAssistant');
    window.addEventListener('dpp:open-ai-session', handleOpenAISession);
    return () => window.removeEventListener('dpp:open-ai-session', handleOpenAISession);
  }, [handleTabChange]);

  return (
    <ToastProvider>
      <ConfirmDialogProvider>
        <div className="relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-background text-foreground">
          {settingsReady && (
            <SidepanelContent
              activeTab={activeTab}
              featureToggles={featureToggles}
              onModuleSelect={handleTabChange}
              onBackToAssistant={() => handleTabChange('aiAssistant')}
              recentTabs={recentTabs}
              isMinimalMode={isMinimalMode}
              showSyncButton={showSyncButton}
            />
          )}
        </div>
      </ConfirmDialogProvider>
    </ToastProvider>
  );
}
