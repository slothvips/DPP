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
        <div className="flex flex-col h-full bg-background text-foreground">
          {!isMinimalMode && <SidepanelHeader showSyncButton={showSyncButton} />}

          {!isMinimalMode && (
            <SidepanelTabBar
              activeTab={activeTab}
              draggedTab={draggedTab}
              tabOrder={tabOrder}
              featureToggles={featureToggles}
              showJenkinsTab={showJenkinsTab}
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
      </ConfirmDialogProvider>
    </ToastProvider>
  );
}
