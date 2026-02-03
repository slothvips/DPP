export const SYNC = {
  ALARM_NAME: 'dpp_auto_sync',
  LINKS_INTERVAL_MINUTES: 10,
  DEFAULT_API_URL: 'http://localhost:3000',
} as const;

export const JENKINS = {
  POLL_INTERVAL_MS: 10_000,
  PAGE_SIZE: 100,
  MAX_CONCURRENT_REQUESTS: 5,
} as const;

export const HOT_NEWS = {
  CACHE_HOURS: 24,
  MAX_CACHE_DAYS: 7,
  API_BASE_URL: 'https://slothvips.github.io/daily-hot-news/archives',
} as const;
