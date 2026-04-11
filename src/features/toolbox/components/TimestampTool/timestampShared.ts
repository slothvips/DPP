export const TIMEZONES = [
  { label: '本地时间', value: 'local' },
  { label: 'UTC', value: 'UTC' },
  { label: '北京时间 (UTC+8)', value: 'Asia/Shanghai' },
  { label: '东京时间 (UTC+9)', value: 'Asia/Tokyo' },
  { label: '洛杉矶 (UTC-8)', value: 'America/Los_Angeles' },
  { label: '纽约 (UTC-5)', value: 'America/New_York' },
] as const;

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const MONTHS = [
  '一月',
  '二月',
  '三月',
  '四月',
  '五月',
  '六月',
  '七月',
  '八月',
  '九月',
  '十月',
  '十一月',
  '十二月',
];

const MIN_TIMESTAMP = -8640000000000000;
const MAX_TIMESTAMP = 8640000000000000;

export interface TimestampDateDetails {
  ts: number;
  tsSeconds: number;
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
  dayOfWeek: string;
  dayOfYear: number;
  weekNum: number;
  monthName: string;
  isoString: string;
  localStr: string;
  utcStr: string;
  relative: string;
  padded: {
    month: string;
    day: string;
    hours: string;
    minutes: string;
    seconds: string;
  };
}

export function parseToDate(input: string): Date | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const num = Number(trimmed);
  if (!Number.isNaN(num)) {
    const absNum = Math.abs(num);
    const msTimestamp = absNum < 1e12 ? num * 1000 : num;
    if (msTimestamp < MIN_TIMESTAMP || msTimestamp > MAX_TIMESTAMP) {
      return null;
    }
    return new Date(msTimestamp);
  }

  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const timestamp = parsed.getTime();
  if (timestamp < MIN_TIMESTAMP || timestamp > MAX_TIMESTAMP) {
    return null;
  }

  return parsed;
}

function formatRelativeTime(date: Date, now: Date): string {
  const diff = now.getTime() - date.getTime();
  const absDiff = Math.abs(diff);
  const isPast = diff > 0;
  const seconds = Math.floor(absDiff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) return `${years} 年${isPast ? '前' : '后'}`;
  if (months > 0) return `${months} 月${isPast ? '前' : '后'}`;
  if (weeks > 0) return `${weeks} 周${isPast ? '前' : '后'}`;
  if (days > 0) return `${days} 天${isPast ? '前' : '后'}`;
  if (hours > 0) return `${hours} 小时${isPast ? '前' : '后'}`;
  if (minutes > 0) return `${minutes} 分钟${isPast ? '前' : '后'}`;
  return `${seconds} 秒${isPast ? '前' : '后'}`;
}

function getTzDateParts(date: Date, timezone: string) {
  if (timezone === 'local') {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hours: date.getHours(),
      minutes: date.getMinutes(),
      seconds: date.getSeconds(),
      dayOfWeek: date.getDay(),
    };
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
    weekday: 'short',
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || '';
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    year: parseInt(getPart('year'), 10),
    month: parseInt(getPart('month'), 10),
    day: parseInt(getPart('day'), 10),
    hours: parseInt(getPart('hour'), 10),
    minutes: parseInt(getPart('minute'), 10),
    seconds: parseInt(getPart('second'), 10),
    dayOfWeek: weekdayMap[getPart('weekday')] ?? 0,
  };
}

function getISOWeek(date: Date): number {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function buildDateDetails(date: Date, timezone: string): TimestampDateDetails {
  const ts = date.getTime();
  const tsSeconds = Math.floor(ts / 1000);
  const { year, month, day, hours, minutes, seconds, dayOfWeek } = getTzDateParts(date, timezone);
  const utcYear = date.getUTCFullYear();

  return {
    ts,
    tsSeconds,
    year,
    month,
    day,
    hours,
    minutes,
    seconds,
    dayOfWeek: WEEKDAYS[dayOfWeek],
    dayOfYear: Math.floor((date.getTime() - Date.UTC(utcYear, 0, 1)) / 86400000) + 1,
    weekNum: getISOWeek(date),
    monthName: MONTHS[month - 1],
    isoString: date.toISOString(),
    localStr: date.toLocaleString('zh-CN'),
    utcStr: date.toUTCString(),
    relative: formatRelativeTime(date, new Date()),
    padded: {
      month: String(month).padStart(2, '0'),
      day: String(day).padStart(2, '0'),
      hours: String(hours).padStart(2, '0'),
      minutes: String(minutes).padStart(2, '0'),
      seconds: String(seconds).padStart(2, '0'),
    },
  };
}
