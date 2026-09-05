import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_TAB_ORDER, TAB_CONFIG } from './sidepanelTabs';
import type { FeatureToggles, ModuleTabId, TabId } from './sidepanelTypes';

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

function getInitialModule(): ModuleTabId | null {
  const tabParam = new URLSearchParams(window.location.search).get('tab');
  if (isValidTabId(tabParam) && tabParam !== 'aiAssistant') {
    return tabParam;
  }
  return null;
}

interface UseSidepanelTabsOptions {
  featureToggles: FeatureToggles;
}

export function useSidepanelTabs({ featureToggles }: UseSidepanelTabsOptions) {
  const [activeModule, setActiveModule] = useState<ModuleTabId | null>(getInitialModule);
  const [recentTabs, setRecentTabs] = useState<TabId[]>(getInitialRecentTabs);

  useEffect(() => {
    if (!activeModule || TAB_CONFIG[activeModule].getVisible({ featureToggles })) {
      return;
    }
    setActiveModule(null);
  }, [activeModule, featureToggles]);

  const handleTabChange = useCallback((tabId: TabId) => {
    if (tabId === 'aiAssistant') {
      setActiveModule(null);
      return;
    }

    setActiveModule(tabId);

    setRecentTabs((previous) => {
      const next = [tabId, ...previous.filter((recentTab) => recentTab !== tabId)].slice(
        0,
        RECENT_TAB_LIMIT
      );
      localStorage.setItem(RECENT_TABS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return {
    activeModule,
    handleTabChange,
    recentTabs,
  };
}
