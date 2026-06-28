import React from 'react';
import { ToastProvider } from '@/components/ui/toast';
import { useTheme } from '@/hooks/useTheme';
import { ConfirmDialogProvider } from '@/utils/confirm-dialog';
import { SidepanelContent } from './SidepanelContent';
import { SidepanelHeader } from './SidepanelHeader';
import { SidepanelTabBar } from './SidepanelTabBar';
import { useSidepanelAutoPull } from './useSidepanelAutoPull';
import { useSidepanelSettings } from './useSidepanelSettings';
import { useSidepanelTabs } from './useSidepanelTabs';

export function App() {
  useTheme();
  useSidepanelAutoPull();

  const { featureToggles, isMinimalMode, showJenkinsTab, showSyncButton } = useSidepanelSettings();
  const {
    activeTab,
    draggedTab,
    handleDragEnd,
    handleDragOver,
    handleDragStart,
    handleTabChange,
    tabOrder,
  } = useSidepanelTabs({ featureToggles, showJenkinsTab });

  return (
    <ToastProvider>
      <ConfirmDialogProvider>
        <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-gradient-to-b from-background via-background to-muted/20 text-foreground dark:from-background dark:via-background dark:to-secondary/35">
          {!isMinimalMode && <SidepanelHeader />}

          <div className="flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden">
            {!isMinimalMode && (
              <SidepanelTabBar
                activeTab={activeTab}
                draggedTab={draggedTab}
                tabOrder={tabOrder}
                featureToggles={featureToggles}
                showJenkinsTab={showJenkinsTab}
                showSyncButton={showSyncButton}
                handleTabChange={handleTabChange}
                handleDragStart={handleDragStart}
                handleDragOver={handleDragOver}
                handleDragEnd={handleDragEnd}
              />
            )}

            <SidepanelContent
              activeTab={activeTab}
              featureToggles={featureToggles}
              showJenkinsTab={showJenkinsTab}
            />
          </div>
        </div>
      </ConfirmDialogProvider>
    </ToastProvider>
  );
}
