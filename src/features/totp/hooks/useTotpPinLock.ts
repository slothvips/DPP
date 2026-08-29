import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { logger } from '@/utils/logger';
import { DEFAULT_TOTP_PIN_AUTO_LOCK_MINUTES, getTotpPinConfig, verifyTotpPin } from '../totpPin';
import {
  isTotpPinSessionUnlocked,
  lockTotpPinSession,
  setTotpPinSessionUnlocked,
} from '../totpPinSession';

interface UseTotpPinLockOptions {
  /** 验证器标签是否处于前台 */
  isActive: boolean;
}

export function useTotpPinLock({ isActive }: UseTotpPinLockOptions) {
  const config = useLiveQuery(() => getTotpPinConfig(), []);
  const pinEnabled = config?.enabled === true;
  const autoLockMinutes = config?.autoLockMinutes ?? DEFAULT_TOTP_PIN_AUTO_LOCK_MINUTES;

  const [unlocked, setUnlocked] = useState(() => isTotpPinSessionUnlocked());
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  function lock() {
    lockTotpPinSession();
    setUnlocked(false);
    setUnlockError(null);
  }

  function markUnlocked() {
    setTotpPinSessionUnlocked(true);
    setUnlocked(true);
    setUnlockError(null);
  }

  async function unlock(pin: string): Promise<boolean> {
    setUnlocking(true);
    setUnlockError(null);
    try {
      const ok = await verifyTotpPin(pin);
      if (!ok) {
        setUnlockError('PIN 不正确');
        lock();
        return false;
      }
      markUnlocked();
      return true;
    } catch (error) {
      logger.error('Failed to verify TOTP PIN:', error);
      setUnlockError('解锁失败，请稍后重试');
      return false;
    } finally {
      setUnlocking(false);
    }
  }

  // 进程内会话仍解锁时，恢复 UI 解锁态（例如刚设置完 PIN）
  useEffect(() => {
    if (pinEnabled && isTotpPinSessionUnlocked()) {
      setUnlocked(true);
    }
  }, [pinEnabled]);

  // 离开验证器标签时锁定
  useEffect(() => {
    if (!pinEnabled) return;
    if (!isActive && unlocked) {
      lock();
    }
  }, [isActive, pinEnabled, unlocked]);

  // 页面/侧边栏隐藏时锁定
  useEffect(() => {
    if (!pinEnabled) return;

    function handleVisibility() {
      if (document.visibilityState === 'hidden' && isTotpPinSessionUnlocked()) {
        lock();
      }
    }

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [pinEnabled]);

  // 空闲超时锁定
  useEffect(() => {
    if (!pinEnabled || !unlocked || !isActive || autoLockMinutes <= 0) return;

    let timer = window.setTimeout(
      () => {
        lock();
      },
      autoLockMinutes * 60 * 1000
    );

    function bump() {
      window.clearTimeout(timer);
      timer = window.setTimeout(
        () => {
          lock();
        },
        autoLockMinutes * 60 * 1000
      );
    }

    const events: Array<keyof DocumentEventMap> = [
      'pointerdown',
      'keydown',
      'mousemove',
      'scroll',
      'touchstart',
    ];
    for (const event of events) {
      document.addEventListener(event, bump, { passive: true });
    }

    return () => {
      window.clearTimeout(timer);
      for (const event of events) {
        document.removeEventListener(event, bump);
      }
    };
  }, [pinEnabled, unlocked, isActive, autoLockMinutes]);

  // 关闭 PIN 后清除会话锁
  useEffect(() => {
    if (config && !config.enabled && unlocked) {
      lock();
    }
  }, [config, unlocked]);

  const locked = pinEnabled && !unlocked;

  return {
    ready: config !== undefined,
    pinEnabled,
    autoLockMinutes,
    locked,
    unlocked,
    unlocking,
    unlockError,
    unlock,
    lock,
    markUnlocked,
    clearUnlockError: () => setUnlockError(null),
  };
}
