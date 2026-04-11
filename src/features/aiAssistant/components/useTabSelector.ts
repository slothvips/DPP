import { useCallback, useEffect, useMemo, useState } from 'react';
import { isInjectable } from '@/lib/pageAgent/injector';
import { logger } from '@/utils/logger';

const TAB_ID_STORAGE_KEY = '__pageAgentTabId';
const ALWAYS_ACTIVE_TAB_ID = null;

export interface PageAgentTabInfo {
  id: number;
  title: string;
  url: string;
  favIconUrl?: string;
  active?: boolean;
}

interface UseTabSelectorOptions {
  selectedTabId: number | null;
  onTabSelect: (tabId: number | null) => void;
}

export function useTabSelector({ selectedTabId, onTabSelect }: UseTabSelectorOptions) {
  const [isOpen, setIsOpen] = useState(false);
  const [tabs, setTabs] = useState<PageAgentTabInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadTabs = useCallback(async () => {
    setIsLoading(true);
    try {
      const allTabs = await browser.tabs.query({});
      const injectableTabs = allTabs.filter((tab) => tab.url && isInjectable(tab.url));
      setTabs(
        injectableTabs.map((tab) => ({
          id: tab.id!,
          title: tab.title || '无标题',
          url: tab.url || '',
          favIconUrl: tab.favIconUrl,
          active: tab.active,
        }))
      );
    } catch (error) {
      logger.error('[TabSelector] Failed to load tabs:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTabs();
  }, [loadTabs]);

  useEffect(() => {
    if (isOpen) {
      void loadTabs();
    }
  }, [isOpen, loadTabs]);

  const selectedTab = useMemo(
    () => tabs.find((tab) => tab.id === selectedTabId),
    [selectedTabId, tabs]
  );

  const persistSelectedTab = async (tabId: number) => {
    try {
      await browser.storage.session.set({ [TAB_ID_STORAGE_KEY]: tabId });
      logger.debug('[TabSelector] Tab ID saved:', tabId);
    } catch (error) {
      logger.error('[TabSelector] Failed to save tab ID:', error);
    }
  };

  const clearSelectedTab = async () => {
    try {
      await browser.storage.session.remove(TAB_ID_STORAGE_KEY);
      logger.debug('[TabSelector] Switched to always-current mode');
    } catch (error) {
      logger.error('[TabSelector] Failed to switch mode:', error);
    }
  };

  const handleTabClick = (tabId: number) => {
    onTabSelect(tabId);
    void persistSelectedTab(tabId);
    setIsOpen(false);
  };

  const handleAlwaysCurrentClick = () => {
    onTabSelect(ALWAYS_ACTIVE_TAB_ID);
    void clearSelectedTab();
    setIsOpen(false);
  };

  return {
    handleAlwaysCurrentClick,
    handleTabClick,
    isLoading,
    isOpen,
    selectedTab,
    setIsOpen,
    tabs,
  };
}
