import { useCallback, useEffect, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { DEFAULT_TAB_ORDER, TAB_CONFIG } from './sidepanelTabs';
import type { FeatureToggles, TabId } from './sidepanelTypes';

function isValidTabId(value: string | null): value is TabId {
  return value !== null && DEFAULT_TAB_ORDER.includes(value as TabId);
}

function getInitialTabOrder(): TabId[] {
  if (typeof localStorage === 'undefined') {
    return DEFAULT_TAB_ORDER;
  }

  const saved = localStorage.getItem('dpp_tab_order');
  if (!saved) {
    return DEFAULT_TAB_ORDER;
  }

  try {
    const parsed = JSON.parse(saved) as TabId[];
    const validTabs = parsed.filter((tabId): tabId is TabId => DEFAULT_TAB_ORDER.includes(tabId));

    return validTabs.length === DEFAULT_TAB_ORDER.length ? validTabs : DEFAULT_TAB_ORDER;
  } catch {
    return DEFAULT_TAB_ORDER;
  }
}

function getInitialActiveTab(): TabId {
  const tabParam = new URLSearchParams(window.location.search).get('tab');
  if (isValidTabId(tabParam)) {
    return tabParam;
  }

  if (typeof localStorage === 'undefined') {
    return 'blackboard';
  }

  const saved = localStorage.getItem('dpp_active_tab');
  return isValidTabId(saved) ? saved : 'blackboard';
}

interface UseSidepanelTabsOptions {
  featureToggles: FeatureToggles;
  showJenkinsTab: boolean;
}

function getFirstVisibleTab(
  tabOrder: TabId[],
  featureToggles: FeatureToggles,
  showJenkinsTab: boolean
): TabId | null {
  return (
    tabOrder.find((tabId) => TAB_CONFIG[tabId].getVisible({ featureToggles, showJenkinsTab })) ??
    null
  );
}

export function useSidepanelTabs({ featureToggles, showJenkinsTab }: UseSidepanelTabsOptions) {
  const [tabOrder, setTabOrder] = useState<TabId[]>(getInitialTabOrder);
  const [activeTab, setActiveTab] = useState<TabId>(getInitialActiveTab);
  const [draggedTab, setDraggedTab] = useState<TabId | null>(null);
  const tabOrderRef = useRef(tabOrder);

  tabOrderRef.current = tabOrder;

  useEffect(() => {
    const isActiveTabVisible = TAB_CONFIG[activeTab].getVisible({ featureToggles, showJenkinsTab });
    if (isActiveTabVisible) {
      return;
    }

    const fallbackTab = getFirstVisibleTab(tabOrder, featureToggles, showJenkinsTab);
    if (!fallbackTab) {
      return;
    }

    setActiveTab(fallbackTab);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('dpp_active_tab', fallbackTab);
    }
  }, [activeTab, featureToggles, showJenkinsTab, tabOrder]);

  const handleDragStart = useCallback((tabId: TabId) => {
    setDraggedTab(tabId);
  }, []);

  const handleDragOver = useCallback(
    (event: DragEvent, targetTab: TabId) => {
      event.preventDefault();
      if (!draggedTab || draggedTab === targetTab) {
        return;
      }

      setTabOrder((prev) => {
        const next = [...prev];
        const draggedIndex = next.indexOf(draggedTab);
        const targetIndex = next.indexOf(targetTab);

        if (draggedIndex === -1 || targetIndex === -1) {
          return prev;
        }

        next.splice(draggedIndex, 1);
        next.splice(targetIndex, 0, draggedTab);
        return next;
      });
    },
    [draggedTab]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedTab(null);

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('dpp_tab_order', JSON.stringify(tabOrderRef.current));
    }
  }, []);

  const handleTabChange = useCallback((tabId: TabId) => {
    setActiveTab(tabId);

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('dpp_active_tab', tabId);
    }
  }, []);

  return {
    activeTab,
    draggedTab,
    handleDragEnd,
    handleDragOver,
    handleDragStart,
    handleTabChange,
    tabOrder,
  };
}
