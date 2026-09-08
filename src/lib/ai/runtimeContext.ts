export function buildRuntimeContext(
  now = new Date(),
  locale = getRuntimeLocale(),
  timeZone = getRuntimeTimeZone()
): string {
  const parts = new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'longOffset',
  }).formatToParts(now);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  const date = `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
  const time = `${getPart('hour')}:${getPart('minute')}:${getPart('second')}`;
  const weekday = new Intl.DateTimeFormat(locale, { timeZone, weekday: 'long' }).format(now);

  return `## 当前运行环境
- 当前日期：${date}
- 当前时间：${time}
- 星期：${weekday}
- 用户时区：${timeZone}（${getPart('timeZoneName')}）
- UTC 时间：${now.toISOString()}
- 时间来源：浏览器所在设备的系统时钟
- 用户语言：${locale}`;
}

function getRuntimeLocale(): string {
  return typeof navigator !== 'undefined' && navigator.language
    ? navigator.language
    : Intl.DateTimeFormat().resolvedOptions().locale;
}

function getRuntimeTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}
