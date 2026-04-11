import { useEffect } from 'react';
import { browser } from 'wxt/browser';
import { logger } from '@/utils/logger';

export function useSidepanelAutoPull() {
  useEffect(() => {
    const triggerAutoPull = () => {
      if (typeof browser === 'undefined' || !browser.runtime) {
        return;
      }

      logger.debug('[SidePanel] Sending AUTO_SYNC_TRIGGER_PULL');
      browser.runtime.sendMessage({ type: 'AUTO_SYNC_TRIGGER_PULL' }).catch((error) => {
        logger.error(error);
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        triggerAutoPull();
      }
    };

    triggerAutoPull();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
}
