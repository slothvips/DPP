import BigNumber from 'bignumber.js';
import { type ToolHandler, createToolParameter, toolRegistry } from '../tools';

const LINEAR_UNITS = {
  millimeter: { category: 'length', numerator: '0.001' },
  centimeter: { category: 'length', numerator: '0.01' },
  meter: { category: 'length', numerator: '1' },
  kilometer: { category: 'length', numerator: '1000' },
  inch: { category: 'length', numerator: '0.0254' },
  foot: { category: 'length', numerator: '0.3048' },
  yard: { category: 'length', numerator: '0.9144' },
  mile: { category: 'length', numerator: '1609.344' },
  nautical_mile: { category: 'length', numerator: '1852' },
  square_millimeter: { category: 'area', numerator: '0.000001' },
  square_centimeter: { category: 'area', numerator: '0.0001' },
  square_meter: { category: 'area', numerator: '1' },
  square_kilometer: { category: 'area', numerator: '1000000' },
  square_inch: { category: 'area', numerator: '0.00064516' },
  square_foot: { category: 'area', numerator: '0.09290304' },
  square_yard: { category: 'area', numerator: '0.83612736' },
  acre: { category: 'area', numerator: '4046.8564224' },
  hectare: { category: 'area', numerator: '10000' },
  milligram: { category: 'mass', numerator: '0.000001' },
  gram: { category: 'mass', numerator: '0.001' },
  kilogram: { category: 'mass', numerator: '1' },
  metric_ton: { category: 'mass', numerator: '1000' },
  ounce: { category: 'mass', numerator: '0.028349523125' },
  pound: { category: 'mass', numerator: '0.45359237' },
  millisecond: { category: 'time', numerator: '0.001' },
  second: { category: 'time', numerator: '1' },
  minute: { category: 'time', numerator: '60' },
  hour: { category: 'time', numerator: '3600' },
  day: { category: 'time', numerator: '86400' },
  week: { category: 'time', numerator: '604800' },
  meter_per_second: { category: 'speed', numerator: '1' },
  kilometer_per_hour: { category: 'speed', numerator: '1000', denominator: '3600' },
  mile_per_hour: { category: 'speed', numerator: '0.44704' },
  knot: { category: 'speed', numerator: '1852', denominator: '3600' },
  byte: { category: 'data', numerator: '1' },
  kilobyte: { category: 'data', numerator: '1000' },
  megabyte: { category: 'data', numerator: '1000000' },
  gigabyte: { category: 'data', numerator: '1000000000' },
  terabyte: { category: 'data', numerator: '1000000000000' },
  kibibyte: { category: 'data', numerator: '1024' },
  mebibyte: { category: 'data', numerator: '1048576' },
  gibibyte: { category: 'data', numerator: '1073741824' },
  tebibyte: { category: 'data', numerator: '1099511627776' },
} as const;

const TEMPERATURE_UNITS = ['celsius', 'fahrenheit', 'kelvin'] as const;
const UNIT_NAMES = [...Object.keys(LINEAR_UNITS), ...TEMPERATURE_UNITS];
const DECIMAL_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
const DEFAULT_PRECISION = 20;

type LinearUnit = keyof typeof LINEAR_UNITS;
type TemperatureUnit = (typeof TEMPERATURE_UNITS)[number];

interface UnitConversionArgs {
  value: string;
  from_unit: string;
  to_unit: string;
  precision?: number;
}

export async function runUnitConversion({
  value,
  from_unit,
  to_unit,
  precision,
}: UnitConversionArgs) {
  const outputPrecision = precision ?? DEFAULT_PRECISION;
  if (!DECIMAL_PATTERN.test(value)) throw new Error(`不是有效十进制数：${value}`);
  const Decimal = BigNumber.clone({
    DECIMAL_PLACES: outputPrecision,
    ROUNDING_MODE: BigNumber.ROUND_HALF_UP,
    EXPONENTIAL_AT: 1_000_000,
  });
  const input = new Decimal(value);
  if (!input.isFinite() || Math.abs(input.e ?? 0) > 1000) throw new Error('数值指数不能超过 1000');

  const fromTemperature = isTemperatureUnit(from_unit);
  const toTemperature = isTemperatureUnit(to_unit);
  if (from_unit === to_unit) {
    const category = fromTemperature ? 'temperature' : getLinearUnit(from_unit).category;
    if (fromTemperature) assertNotBelowAbsoluteZero(input, from_unit);
    return {
      category,
      input: { value, unit: from_unit },
      output: { value: input.toFixed(), unit: to_unit },
      exact: true,
    };
  }
  let result: BigNumber;
  let category: string;
  let mathematicallyZero: boolean;

  if (fromTemperature || toTemperature) {
    if (!fromTemperature || !toTemperature) throw new Error('不能在温度与其他单位类别之间转换');
    assertNotBelowAbsoluteZero(input, from_unit);
    const converted = convertTemperature(input, from_unit, to_unit);
    result = converted.result;
    mathematicallyZero = converted.mathematicallyZero;
    category = 'temperature';
  } else {
    const from = getLinearUnit(from_unit);
    const to = getLinearUnit(to_unit);
    if (from.category !== to.category) throw new Error('from_unit 和 to_unit 必须属于同一类别');
    const numerator = input.times(from.numerator).times('denominator' in to ? to.denominator : 1);
    const denominator = new Decimal('denominator' in from ? from.denominator : 1).times(
      to.numerator
    );
    result = numerator.dividedBy(denominator);
    mathematicallyZero = input.isZero();
    category = from.category;
  }

  if (!result.isFinite()) throw new Error('转换结果超出可表示范围');
  const rounded = result.decimalPlaces(outputPrecision, BigNumber.ROUND_HALF_UP);
  if (precision === undefined && !mathematicallyZero && rounded.isZero()) {
    throw new Error('非零结果小于默认 20 位小数精度，请明确指定更高 precision');
  }
  const resultText = rounded.toFixed();
  if (resultText.length > 10_000) throw new Error('转换结果过长');
  const knownExact =
    rounded.isEqualTo(result) &&
    fromTemperature &&
    toTemperature &&
    from_unit !== 'fahrenheit' &&
    to_unit !== 'fahrenheit';
  return {
    category,
    input: { value, unit: from_unit },
    output: { value: resultText, unit: to_unit },
    ...(knownExact
      ? { exact: true as const }
      : { precision: outputPrecision, rounding_mode: 'half_up' as const }),
  };
}

function getLinearUnit(unit: string): (typeof LINEAR_UNITS)[LinearUnit] {
  if (!(unit in LINEAR_UNITS)) throw new Error(`不支持的单位：${unit}`);
  return LINEAR_UNITS[unit as LinearUnit];
}

function isTemperatureUnit(unit: string): unit is TemperatureUnit {
  return TEMPERATURE_UNITS.some((candidate) => candidate === unit);
}

function assertNotBelowAbsoluteZero(value: BigNumber, unit: TemperatureUnit): void {
  const minimum = unit === 'kelvin' ? '0' : unit === 'celsius' ? '-273.15' : '-459.67';
  if (value.isLessThan(minimum)) throw new Error('温度不能低于绝对零度');
}

function convertTemperature(
  value: BigNumber,
  from: TemperatureUnit,
  to: TemperatureUnit
): { result: BigNumber; mathematicallyZero: boolean } {
  if (from === 'celsius' && to === 'kelvin') {
    const result = value.plus('273.15');
    return { result, mathematicallyZero: result.isZero() };
  }
  if (from === 'kelvin' && to === 'celsius') {
    const result = value.minus('273.15');
    return { result, mathematicallyZero: result.isZero() };
  }
  let numerator: BigNumber;
  let denominator: number;
  if (from === 'celsius') {
    numerator = value.times(9).plus(160);
    denominator = 5;
  } else if (to === 'celsius') {
    numerator = value.minus(32).times(5);
    denominator = 9;
  } else if (from === 'fahrenheit') {
    numerator = value.minus(32).times(5).plus('2458.35');
    denominator = 9;
  } else {
    numerator = value.minus('273.15').times(9).plus(160);
    denominator = 5;
  }
  return {
    result: numerator.dividedBy(denominator),
    mathematicallyZero: numerator.isZero(),
  };
}

export function registerUnitConversionTools(): void {
  toolRegistry.register({
    name: 'convert_units',
    description:
      '在同类常用单位之间进行高精度十进制换算，支持长度、面积、质量、温度、时间、速度和数据容量。为避免 JSON 浮点精度损失，value 必须传十进制字符串，结果也返回字符串。kilobyte/megabyte 使用十进制，kibibyte/mebibyte 使用二进制；除明确返回 exact=true 外，结果按 precision（默认 20）位和 half_up 规则计算，不应宣称无限精度。货币不属于此工具。',
    parameters: createToolParameter(
      {
        value: {
          type: 'string',
          maxLength: 100,
          description: '要换算的十进制数字字符串，支持小数和科学计数法',
        },
        from_unit: {
          type: 'string',
          enum: UNIT_NAMES,
          description: '原单位',
        },
        to_unit: {
          type: 'string',
          enum: UNIT_NAMES,
          description: '目标单位，必须与原单位属于同一类别',
        },
        precision: {
          type: 'integer',
          minimum: 0,
          maximum: 50,
          description: '结果保留的小数位数，默认 20，使用 half_up 舍入',
        },
      },
      ['value', 'from_unit', 'to_unit']
    ),
    handler: runUnitConversion as ToolHandler,
  });
}
