import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect } from 'react';
import { db } from '@/db';

export type Theme = 'light' | 'dark' | 'system';

export function useTheme() {
  const settings = useLiveQuery(() => db.settings.where('key').equals('theme').first());

  const theme = (settings?.value as Theme) || 'system';

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
  }, [theme]);

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
    await db.settings.put({ key: 'theme', value: newTheme });
  };

  return { theme, setTheme };
}
