import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect } from 'react';
import { getSettingByKey, updateSetting } from '@/lib/db/settings';
import { logger } from '@/utils/logger';

export type Theme = 'light' | 'dark';

export interface ThemeTransitionOrigin {
  x: number;
  y: number;
}

let themeTransitionId = 0;

function applyThemeToDom(theme: Theme, origin: ThemeTransitionOrigin | null): void {
  const root = document.documentElement;
  const previousTheme = root.dataset.dppTheme;
  const updateTheme = () => {
    root.classList.toggle('dark', theme === 'dark');
    root.dataset.dppTheme = theme;
  };

  if (previousTheme === theme) return;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!previousTheme || !origin || prefersReducedMotion || !document.startViewTransition) {
    updateTheme();
    return;
  }

  const endRadius = Math.hypot(
    Math.max(origin.x, window.innerWidth - origin.x),
    Math.max(origin.y, window.innerHeight - origin.y)
  );
  const radiusBase = Math.hypot(window.innerWidth, window.innerHeight) / Math.SQRT2;
  const transitionId = ++themeTransitionId;
  const cleanupTransition = () => {
    if (transitionId !== themeTransitionId) return;
    delete root.dataset.themeTransition;
    root.style.removeProperty('--theme-transition-x');
    root.style.removeProperty('--theme-transition-y');
    root.style.removeProperty('--theme-transition-radius');
  };

  root.dataset.themeTransition = theme === 'dark' ? 'to-dark' : 'to-light';
  root.style.setProperty('--theme-transition-x', `${(origin.x / window.innerWidth) * 100}%`);
  root.style.setProperty('--theme-transition-y', `${(origin.y / window.innerHeight) * 100}%`);
  root.style.setProperty('--theme-transition-radius', `${(endRadius / radiusBase) * 100}%`);

  try {
    const transition = document.startViewTransition(updateTheme);
    void transition.finished.then(cleanupTransition, cleanupTransition);
  } catch {
    cleanupTransition();
    updateTheme();
  }
}

export function useTheme() {
  const settings = useLiveQuery(() => getSettingByKey('theme'));

  const storedTheme = settings?.value as string | undefined;
  const theme: Theme =
    storedTheme === 'dark' ||
    (storedTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      ? 'dark'
      : 'light';

  // 应用主题到 DOM
  useEffect(() => {
    applyThemeToDom(theme, null);

    if (storedTheme === 'system') {
      void updateSetting('theme', theme).catch((error: unknown) => {
        logger.error('[useTheme] Failed to migrate system theme:', error);
      });
    }

    try {
      localStorage.setItem('theme', theme);
    } catch {
      // ignore
    }
  }, [storedTheme, theme]);

  const setTheme = async (newTheme: Theme, origin: ThemeTransitionOrigin | null = null) => {
    applyThemeToDom(newTheme, origin);
    try {
      await updateSetting('theme', newTheme);
    } catch (error) {
      applyThemeToDom(theme, null);
      throw error;
    }
  };

  return { theme, setTheme };
}
