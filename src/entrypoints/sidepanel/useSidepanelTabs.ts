import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_TAB_ORDER, TAB_CONFIG } from './sidepanelTabs';
import type { FeatureToggles, TabId } from './sidepanelTypes';

const RECENT_TABS_KEY = 'dpp_recent_tabs';
const RECENT_TAB_LIMIT = 3;

function isValidTabId(value: string | null): value is TabId {
  return value !== null && DEFAULT_TAB_ORDER.includes(value as TabId);
}

function getInitialRecentTabs(): TabId[] {
  if (typeof localStorage === 'undefined') return [];

  try {
    const stored = JSON.parse(localStorage.getItem(RECENT_TABS_KEY) ?? 'null') as unknown;
    if (!Array.isArray(stored)) return [];

    return stored
      .filter((tabId): tabId is string => typeof tabId === 'string')
      .filter((tabId): tabId is TabId => isValidTabId(tabId))
      .filter((tabId) => tabId !== 'aiAssistant')
      .slice(0, RECENT_TAB_LIMIT);
  } catch {
    return [];
  }
}

function getInitialActiveTab(): TabId {
  const tabParam = new URLSearchParams(window.location.search).get('tab');
  if (isValidTabId(tabParam)) {
    return tabParam;
  }

  if (typeof localStorage === 'undefined') return 'aiAssistant';
  const storedTab = localStorage.getItem('dpp_active_tab');
  return isValidTabId(storedTab) ? storedTab : 'aiAssistant';
}

interface UseSidepanelTabsOptions {
  featureToggles: FeatureToggles;
}

function getFirstVisibleTab(featureToggles: FeatureToggles): TabId | null {
  return (
    DEFAULT_TAB_ORDER.find((tabId) => TAB_CONFIG[tabId].getVisible({ featureToggles })) ?? null
  );
}

export function useSidepanelTabs({ featureToggles }: UseSidepanelTabsOptions) {
  const [activeTab, setActiveTab] = useState<TabId>(getInitialActiveTab);
  const [recentTabs, setRecentTabs] = useState<TabId[]>(getInitialRecentTabs);
  const visibleActiveTab = TAB_CONFIG[activeTab].getVisible({ featureToggles })
    ? activeTab
    : (getFirstVisibleTab(featureToggles) ?? activeTab);

  useEffect(() => {
    const isActiveTabVisible = TAB_CONFIG[activeTab].getVisible({ featureToggles });
    if (isActiveTabVisible) {
      return;
    }

    const fallbackTab = getFirstVisibleTab(featureToggles);
    if (!fallbackTab) {
      return;
    }

    setActiveTab(fallbackTab);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('dpp_active_tab', fallbackTab);
    }
  }, [activeTab, featureToggles]);

  const handleTabChange = useCallback((tabId: TabId) => {
    setActiveTab(tabId);

    if (tabId !== 'aiAssistant') {
      setRecentTabs((previous) => {
        const next = [tabId, ...previous.filter((recentTab) => recentTab !== tabId)].slice(
          0,
          RECENT_TAB_LIMIT
        );
        localStorage.setItem(RECENT_TABS_KEY, JSON.stringify(next));
        return next;
      });
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('dpp_active_tab', tabId);
    }
  }, []);

  return {
    activeTab: visibleActiveTab,
    handleTabChange,
    recentTabs,
  };
}
