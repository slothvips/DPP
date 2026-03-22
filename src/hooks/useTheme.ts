import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef } from 'react';
import { getSettingByKey, updateSetting } from '@/lib/db/settings';

export type Theme = 'light' | 'dark' | 'system';

export function useTheme() {
  const settings = useLiveQuery(() => getSettingByKey('theme'));
  const prevThemeRef = useRef<Theme | null>(null);

  const theme = (settings?.value as Theme) || 'system';

  // 应用主题到 DOM
  useEffect(() => {
    const root = document.documentElement;
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
    const effectiveTheme = theme === 'system' ? systemTheme : theme;

    if (effectiveTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // 仅当主题实际变化时同步到 localStorage
    if (prevThemeRef.current !== theme) {
      prevThemeRef.current = theme;
      try {
        localStorage.setItem('theme', theme);
      } catch {
        // ignore
      }
    }
  }, [theme]);

  // 监听系统主题变化
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const root = document.documentElement;
      if (mediaQuery.matches) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const setTheme = async (newTheme: Theme) => {
    await updateSetting('theme', newTheme);
  };

  return { theme, setTheme };
}
