import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useRef, useState } from 'react';
import { db } from '@/db';
import { fetchNews, getAvailableDates } from '@/features/hotNews/api';
import type { DailyNews } from '@/features/hotNews/types';
import { logger } from '@/utils/logger';

const EXPANDED_STORAGE_KEY = 'dpp_hotnews_expanded';
const SCROLL_STORAGE_KEY = 'dpp_hotnews_scroll';

function loadExpandedSections() {
  try {
    const saved = localStorage.getItem(EXPANDED_STORAGE_KEY);
    return saved ? new Set<string>(JSON.parse(saved)) : new Set<string>();
  } catch (error) {
    logger.debug('Failed to parse expanded sections:', error);
    return new Set<string>();
  }
}

export function useHotNewsView() {
  const [date, setDate] = useState(getAvailableDates()[0].value);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(loadExpandedSections);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const cachedNews = useLiveQuery(() => db.hotNews.get(date), [date]);
  const news = cachedNews?.data as DailyNews | undefined;

  useEffect(() => {
    localStorage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify([...expandedSections]));
  }, [expandedSections]);

  useEffect(() => {
    const savedScroll = localStorage.getItem(SCROLL_STORAGE_KEY);
    if (!savedScroll || !scrollContainerRef.current) {
      return;
    }

    requestAnimationFrame(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = Number(savedScroll);
      }
    });
  }, [date, news, expandedSections]);

  const handleScroll = useCallback(() => {
    if (scrollContainerRef.current) {
      localStorage.setItem(SCROLL_STORAGE_KEY, String(scrollContainerRef.current.scrollTop));
    }
  }, []);

  const loadNews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await fetchNews(date);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load news');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    if (!cachedNews) {
      void loadNews();
    }
  }, [cachedNews, loadNews]);

  const toggleSection = (source: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(source)) {
        next.delete(source);
      } else {
        next.add(source);
      }
      return next;
    });
  };

  const handleDateChange = (value: string) => {
    setDate(value);
    setExpandedSections(new Set());
  };

  return {
    date,
    error,
    expandedSections,
    handleDateChange,
    handleScroll,
    loadNews,
    loading,
    news,
    scrollContainerRef,
    toggleSection,
  };
}
