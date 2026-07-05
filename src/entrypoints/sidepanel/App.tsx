import React, { useCallback, useEffect, useState } from 'react';
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
  const [isSideNavExpanded, setIsSideNavExpanded] = useState(false);
  const {
    activeTab,
    draggedTab,
    handleDragEnd,
    handleDragOver,
    handleDragStart,
    handleTabChange,
    tabOrder,
  } = useSidepanelTabs({ featureToggles, showJenkinsTab });

  const expandSideNav = useCallback(() => {
    setIsSideNavExpanded(true);
  }, []);

  const collapseSideNav = useCallback(() => {
    setIsSideNavExpanded(false);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSideNavExpanded(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <ToastProvider>
      <ConfirmDialogProvider>
        <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-gradient-to-b from-background via-background to-muted/20 text-foreground dark:from-background dark:via-background dark:to-secondary/35">
          {!isMinimalMode && (
            <SidepanelHeader activeTab={activeTab} showSyncButton={showSyncButton} />
          )}

          <div className="relative flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden">
            {!isMinimalMode && (
              <SidepanelTabBar
                activeTab={activeTab}
                draggedTab={draggedTab}
                tabOrder={tabOrder}
                featureToggles={featureToggles}
                isExpanded={isSideNavExpanded}
                showJenkinsTab={showJenkinsTab}
                handleTabChange={handleTabChange}
                handleDragStart={handleDragStart}
                handleDragOver={handleDragOver}
                handleDragEnd={handleDragEnd}
                onCollapse={collapseSideNav}
                onExpand={expandSideNav}
              />
            )}

            <SidepanelContent
              activeTab={activeTab}
              featureToggles={featureToggles}
              reserveFloatingNav={!isMinimalMode && !isSideNavExpanded}
              showJenkinsTab={showJenkinsTab}
            />
          </div>
        </div>
      </ConfirmDialogProvider>
    </ToastProvider>
  );
}
