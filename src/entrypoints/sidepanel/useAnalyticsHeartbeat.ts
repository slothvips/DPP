import { useEffect, useRef } from 'react';
import { trackFeaturePresence } from '@/lib/analytics';
import type { ModuleTabId } from './sidepanelTypes';

const HEARTBEAT_INTERVAL_MS = 60_000;

/**
 * sidepanel 模块停留时长的纯旁路统计：
 * 只监听 activeModule 变化并上报 open/close/heartbeat，
 * 不接收、不修改任何切换逻辑（useSidepanelTabs 零改动）。
 * activeModule 为 null（AI 助手主页）时按 'aiAssistant' 模块上报。
 * trackFeaturePresence 自身永不抛出，本 hook 不会影响渲染。
 */
export function useAnalyticsHeartbeat(activeModule: ModuleTabId | null): void {
  const currentRef = useRef<{ module: ModuleTabId | 'aiAssistant'; openedAt: number } | null>(null);

  useEffect(() => {
    const effectiveModule = activeModule ?? 'aiAssistant';
    const previous = currentRef.current;
    if (previous && previous.module !== effectiveModule) {
      trackFeaturePresence(previous.module, 'featureClosed', {
        value: Math.round((Date.now() - previous.openedAt) / 1000),
      });
    }

    trackFeaturePresence(effectiveModule, 'featureOpened');
    currentRef.current = { module: effectiveModule, openedAt: Date.now() };

    return () => {
      const closing = currentRef.current;
      if (closing && closing.module === effectiveModule) {
        trackFeaturePresence(closing.module, 'featureClosed', {
          value: Math.round((Date.now() - closing.openedAt) / 1000),
        });
        currentRef.current = null;
      }
    };
  }, [activeModule]);

  useEffect(() => {
    const timer = setInterval(() => {
      const current = currentRef.current;
      if (current && document.visibilityState === 'visible') {
        trackFeaturePresence(current.module, 'featureHeartbeat');
      }
    }, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);
}
