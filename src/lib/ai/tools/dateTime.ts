import { type ToolHandler, createToolParameter, toolRegistry } from '../tools';

const OPERATIONS = ['now', 'inspect', 'add', 'difference', 'convert_timezone'] as const;
const UNITS = ['year', 'month', 'week', 'day', 'hour', 'minute', 'second', 'millisecond'] as const;
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_INSTANT_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})$/;
const CALENDAR_UNITS = new Set<DateTimeUnit>(['year', 'month', 'week', 'day']);
const ELAPSED_UNIT_MILLISECONDS: Partial<Record<DateTimeUnit, number>> = {
  week: 604_800_000,
  day: 86_400_000,
  hour: 3_600_000,
  minute: 60_000,
  second: 1000,
  millisecond: 1,
};

type DateTimeOperation = (typeof OPERATIONS)[number];
type DateTimeUnit = (typeof UNITS)[number];

interface DateTimeArgs {
  operation: DateTimeOperation;
  date_time?: string;
  end_date_time?: string;
  amount?: number;
  unit?: DateTimeUnit;
  time_zone?: string;
  locale?: string;
}

interface ParsedDateInput {
  date: Date;
  dateOnly: boolean;
}

export async function runDateTime(args: DateTimeArgs) {
  const timeZone = args.time_zone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const locale = args.locale || getRuntimeLocale();

  if (args.operation === 'now') return formatDateTime(new Date(), timeZone, locale);

  const input = requireDateInput(args.date_time, 'date_time');
  if (args.operation === 'inspect') return formatParsedDate(input, timeZone, locale);
  if (args.operation === 'convert_timezone') {
    if (input.dateOnly) throw new Error('时区转换需要包含时间和时区偏移的 date_time');
    return formatDateTime(input.date, timeZone, locale);
  }

  if (args.operation === 'add') {
    if (typeof args.amount !== 'number' || !Number.isInteger(args.amount)) {
      throw new Error('add 操作需要整数 amount');
    }
    if (!args.unit) throw new Error('add 操作需要 unit');
    const result = input.dateOnly
      ? addCalendarDate(input.date, args.amount, args.unit)
      : addElapsedTime(input.date, args.amount, args.unit);
    return {
      ...formatParsedDate({ date: result, dateOnly: input.dateOnly }, timeZone, locale),
      arithmetic: input.dateOnly ? 'calendar' : 'elapsed_time',
    };
  }

  const end = requireDateInput(args.end_date_time, 'end_date_time');
  if (!args.unit) throw new Error('difference 操作需要 unit');
  if (input.dateOnly !== end.dateOnly) throw new Error('difference 不能混用纯日期和绝对时间');
  return getDateDifference(input, end, args.unit);
}

function requireDateInput(value: string | undefined, field: string): ParsedDateInput {
  if (!value) throw new Error(`${field} 不能为空`);
  const dateOnlyMatch = DATE_ONLY_PATTERN.exec(value);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    const date = createCalendarDate(Number(year), Number(month), Number(day), field);
    return { date, dateOnly: true };
  }

  const timestamp = parseTimestamp(value, field);
  if (timestamp) return { date: timestamp, dateOnly: false };

  const instantMatch = ISO_INSTANT_PATTERN.exec(value);
  if (!instantMatch) {
    throw new Error(
      `${field} 必须是 YYYY-MM-DD、带 Z/偏移的 ISO 8601 时间，或 seconds:/milliseconds: 时间戳`
    );
  }
  validateInstantParts(instantMatch, field);
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw new Error(`${field} 不是有效日期时间`);
  return { date: new Date(milliseconds), dateOnly: false };
}

function parseTimestamp(value: string, field: string): Date | null {
  const match = /^(seconds|milliseconds):(-?\d+)$/.exec(value);
  const inferredUnit = /^\d{10}$/.test(value)
    ? 'seconds'
    : /^\d{13}$/.test(value)
      ? 'milliseconds'
      : null;
  if (!match && !inferredUnit) return null;

  const unit = match?.[1] ?? inferredUnit;
  const rawValue = match?.[2] ?? value;
  const timestamp = Number(rawValue);
  const milliseconds = unit === 'seconds' ? timestamp * 1000 : timestamp;
  if (!Number.isSafeInteger(timestamp) || !Number.isSafeInteger(milliseconds)) {
    throw new Error(`${field} 时间戳超出安全整数范围`);
  }
  const date = new Date(milliseconds);
  if (Number.isNaN(date.getTime())) throw new Error(`${field} 时间戳超出 Date 范围`);
  return date;
}

function validateInstantParts(match: RegExpExecArray, field: string): void {
  const [, year, month, day, hour, minute, second = '0', , offset] = match;
  validateCalendarParts(Number(year), Number(month), Number(day), field);
  if (Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) {
    throw new Error(`${field} 包含无效时间`);
  }
  if (offset !== 'Z') {
    if (offset === '-00:00') throw new Error(`${field} 的 -00:00 表示未知偏移，不能作为绝对时间`);
    const [offsetHour, offsetMinute] = offset.slice(1).split(':').map(Number);
    if (offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)) {
      throw new Error(`${field} 包含无效时区偏移`);
    }
  }
}

function createCalendarDate(year: number, month: number, day: number, field: string): Date {
  validateCalendarParts(year, month, day, field);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date;
}

function validateCalendarParts(year: number, month: number, day: number, field: string): void {
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new Error(`${field} 不是有效日期`);
  }
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function addCalendarDate(date: Date, amount: number, unit: DateTimeUnit): Date {
  if (!CALENDAR_UNITS.has(unit)) throw new Error('纯日期只能按 year、month、week 或 day 加减');
  if (unit === 'year' || unit === 'month') {
    const monthDelta = unit === 'year' ? amount * 12 : amount;
    const absoluteMonth = date.getUTCFullYear() * 12 + date.getUTCMonth() + monthDelta;
    const year = Math.floor(absoluteMonth / 12);
    const month = ((absoluteMonth % 12) + 12) % 12;
    if (year < 0 || year > 9999) throw new Error('日期计算结果超出支持范围');
    const day = Math.min(date.getUTCDate(), daysInMonth(year, month + 1));
    return createCalendarDate(year, month + 1, day, '日期计算结果');
  }
  const result = addMilliseconds(date, amount * (unit === 'week' ? 604_800_000 : 86_400_000));
  if (result.getUTCFullYear() < 0 || result.getUTCFullYear() > 9999) {
    throw new Error('纯日期计算结果超出 0000-9999 年范围');
  }
  return result;
}

function addElapsedTime(date: Date, amount: number, unit: DateTimeUnit): Date {
  const multiplier = ELAPSED_UNIT_MILLISECONDS[unit];
  if (!multiplier) {
    throw new Error('绝对时间不能按 year 或 month 加减；请使用纯日期或更明确的时长单位');
  }
  return addMilliseconds(date, amount * multiplier);
}

function addMilliseconds(date: Date, amount: number): Date {
  const timestamp = date.getTime() + amount;
  if (!Number.isSafeInteger(timestamp)) throw new Error('日期计算结果超出安全范围');
  const result = new Date(timestamp);
  if (Number.isNaN(result.getTime())) throw new Error('日期计算结果超出 Date 范围');
  return result;
}

function getDateDifference(start: ParsedDateInput, end: ParsedDateInput, unit: DateTimeUnit) {
  if (start.dateOnly) {
    if (!CALENDAR_UNITS.has(unit)) throw new Error('纯日期差只支持 year、month、week 或 day');
    const value = getCalendarDateDifference(end.date, start.date, unit);
    const elapsedDays = Math.trunc((end.date.getTime() - start.date.getTime()) / 86_400_000);
    return {
      operation: 'difference',
      semantics: 'completed_calendar_units',
      unit,
      value,
      ...(unit === 'week' ? { remainder_days: elapsedDays - value * 7 } : {}),
      ...(unit === 'year' || unit === 'month'
        ? { definition: 'maximum whole units using end-of-month clamping' }
        : {}),
      start: start.date.toISOString().slice(0, 10),
      end: end.date.toISOString().slice(0, 10),
    };
  }

  const divisor = ELAPSED_UNIT_MILLISECONDS[unit];
  if (!divisor) throw new Error('绝对时间差不支持 year 或 month；请使用 week 到 millisecond');
  const elapsedMilliseconds = end.date.getTime() - start.date.getTime();
  if (!Number.isSafeInteger(elapsedMilliseconds)) throw new Error('时间差超出安全整数范围');
  const wholeUnits = Math.trunc(elapsedMilliseconds / divisor);
  return {
    operation: 'difference',
    semantics: 'completed_elapsed_units',
    unit,
    value: wholeUnits,
    remainder_ms: elapsedMilliseconds - wholeUnits * divisor,
    elapsed_ms: elapsedMilliseconds,
    start: start.date.toISOString(),
    end: end.date.toISOString(),
  };
}

function getCalendarDateDifference(end: Date, start: Date, unit: DateTimeUnit): number {
  const days = Math.trunc((end.getTime() - start.getTime()) / 86_400_000);
  if (unit === 'day') return days;
  if (unit === 'week') return Math.trunc(days / 7);
  if (end < start) return -getCalendarDateDifference(start, end, unit);

  const roughDifference =
    unit === 'year'
      ? end.getUTCFullYear() - start.getUTCFullYear()
      : (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
        end.getUTCMonth() -
        start.getUTCMonth();
  return addCalendarDate(start, roughDifference, unit) > end
    ? roughDifference - 1
    : roughDifference;
}

function formatParsedDate(input: ParsedDateInput, timeZone: string, locale: string) {
  if (!input.dateOnly) return formatDateTime(input.date, timeZone, locale);
  return {
    input_kind: 'calendar_date',
    date: input.date.toISOString().slice(0, 10),
    weekday: new Intl.DateTimeFormat(locale, { timeZone: 'UTC', weekday: 'long' }).format(
      input.date
    ),
  };
}

function formatDateTime(date: Date, timeZone: string, locale: string) {
  const formatter = new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'longOffset',
  });
  const parts = formatter.formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';

  return {
    iso: date.toISOString(),
    timestamp_ms: date.getTime(),
    timestamp_seconds: Math.floor(date.getTime() / 1000),
    date: `${getPart('year')}-${getPart('month')}-${getPart('day')}`,
    time: `${getPart('hour')}:${getPart('minute')}:${getPart('second')}`,
    weekday: new Intl.DateTimeFormat(locale, { timeZone, weekday: 'long' }).format(date),
    time_zone: timeZone,
    utc_offset: getPart('timeZoneName'),
  };
}

function getRuntimeLocale(): string {
  return typeof navigator !== 'undefined' && navigator.language
    ? navigator.language
    : Intl.DateTimeFormat().resolvedOptions().locale;
}

export function registerDateTimeTools(): void {
  toolRegistry.register({
    name: 'date_time',
    description:
      '查询日期、星期和指定时区时间，执行无歧义的日期加减、日期差或时区转换。当前日期时间已在系统上下文提供。纯日期使用 YYYY-MM-DD，只能做日历 year/month/week/day 运算；绝对时间必须是带 Z 或 ±HH:mm 偏移的 ISO 8601，只能按经过的 week/day/hour/minute/second/millisecond 运算，其中 day 固定为 24 小时。时间戳使用 seconds:<整数> 或 milliseconds:<整数>；也接受常见 10 位秒、13 位毫秒时间戳。',
    parameters: createToolParameter(
      {
        operation: {
          type: 'string',
          enum: [...OPERATIONS],
          description: '操作：当前时间、解析日期、日期加减、日期差、时区转换',
        },
        date_time: {
          type: 'string',
          maxLength: 100,
          description: '起始日期：YYYY-MM-DD、带偏移的 ISO 8601 或明确单位的时间戳；now 不需要',
        },
        end_date_time: {
          type: 'string',
          maxLength: 100,
          description: 'difference 的结束日期，必须与 date_time 同为纯日期或绝对时间',
        },
        amount: {
          type: 'integer',
          minimum: -1_000_000,
          maximum: 1_000_000,
          description: 'add 的整数增减数量，可为负数',
        },
        unit: {
          type: 'string',
          enum: [...UNITS],
          description: 'add 或 difference 的时间单位，须符合纯日期/绝对时间规则',
        },
        time_zone: {
          type: 'string',
          maxLength: 100,
          description: '结果展示使用的 IANA 时区，例如 Asia/Shanghai；不改变运算语义',
        },
        locale: {
          type: 'string',
          maxLength: 50,
          description: '星期名称使用的 BCP 47 语言标记，默认使用用户语言',
        },
      },
      ['operation']
    ),
    handler: runDateTime as ToolHandler,
  });
}
