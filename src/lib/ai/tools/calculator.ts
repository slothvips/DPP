import BigNumber from 'bignumber.js';
import { type ToolHandler, createToolParameter, toolRegistry } from '../tools';

const OPERATIONS = [
  'add',
  'subtract',
  'multiply',
  'divide',
  'power',
  'modulo',
  'average',
  'minimum',
  'maximum',
  'percentage_of',
  'percentage_change',
  'round',
] as const;
const DECIMAL_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
const DEFAULT_PRECISION = 20;
const MAX_INPUT_EXPONENT = 1000;
const MAX_OUTPUT_LENGTH = 10_000;

type CalculatorOperation = (typeof OPERATIONS)[number];

interface CalculatorArgs {
  operation: CalculatorOperation;
  values: string[];
  precision?: number;
}

export async function runCalculation({ operation, values, precision }: CalculatorArgs) {
  if (values.length === 0) throw new Error('values 至少需要一个数字');
  if (values.length > 1000) throw new Error('values 最多允许 1000 个数字');

  const outputPrecision = precision ?? (operation === 'round' ? 0 : DEFAULT_PRECISION);
  const Decimal = BigNumber.clone({
    DECIMAL_PLACES: outputPrecision,
    ROUNDING_MODE: BigNumber.ROUND_HALF_UP,
    EXPONENTIAL_AT: 1_000_000,
  });
  const numbers = values.map((value) => parseDecimal(value, Decimal));
  let result: BigNumber;
  let divisionBased = false;
  let nonzeroDivisionNumerator = false;

  switch (operation) {
    case 'add':
      result = numbers.reduce((total, value) => total.plus(value), new Decimal(0));
      break;
    case 'subtract':
      requireValueCount(numbers, 2, operation);
      result = numbers[0].minus(numbers[1]);
      break;
    case 'multiply':
      result = numbers.reduce((total, value) => total.times(value), new Decimal(1));
      break;
    case 'divide':
      requireValueCount(numbers, 2, operation);
      if (numbers[1].isZero()) throw new Error('不能除以零');
      nonzeroDivisionNumerator = !numbers[0].isZero();
      result = numbers[0].dividedBy(numbers[1]);
      divisionBased = true;
      break;
    case 'power': {
      requireValueCount(numbers, 2, operation);
      const exponent = numbers[1];
      if (!exponent.isInteger() || exponent.abs().isGreaterThan(10_000)) {
        throw new Error('power 的指数必须是绝对值不超过 10000 的整数');
      }
      result = numbers[0].pow(exponent.toNumber());
      divisionBased = exponent.isNegative();
      nonzeroDivisionNumerator = divisionBased;
      break;
    }
    case 'modulo':
      requireValueCount(numbers, 2, operation);
      if (numbers[1].isZero()) throw new Error('模运算的除数不能为零');
      result = numbers[0].modulo(numbers[1]);
      break;
    case 'average':
      result = numbers.reduce((total, value) => total.plus(value), new Decimal(0));
      nonzeroDivisionNumerator = !result.isZero();
      result = result.dividedBy(numbers.length);
      divisionBased = true;
      break;
    case 'minimum':
      result = Decimal.minimum(...numbers);
      break;
    case 'maximum':
      result = Decimal.maximum(...numbers);
      break;
    case 'percentage_of':
      requireValueCount(numbers, 2, operation);
      if (numbers[1].isZero()) throw new Error('计算占比时基数不能为零');
      nonzeroDivisionNumerator = !numbers[0].isZero();
      result = numbers[0].times(100).dividedBy(numbers[1]);
      divisionBased = true;
      break;
    case 'percentage_change':
      requireValueCount(numbers, 2, operation);
      if (numbers[0].isZero()) throw new Error('计算变化率时原始值不能为零');
      result = numbers[1].minus(numbers[0]).times(100);
      nonzeroDivisionNumerator = !result.isZero();
      result = result.dividedBy(numbers[0]);
      divisionBased = true;
      break;
    case 'round':
      requireValueCount(numbers, 1, operation);
      result = numbers[0];
      break;
  }

  if (!result.isFinite()) throw new Error('计算结果超出可表示范围');
  const shouldRound = precision !== undefined || divisionBased || operation === 'round';
  const rounded = shouldRound
    ? result.decimalPlaces(outputPrecision, BigNumber.ROUND_HALF_UP)
    : result;
  if (divisionBased && precision === undefined && nonzeroDivisionNumerator && rounded.isZero()) {
    throw new Error('非零结果小于默认 20 位小数精度，请明确指定更高 precision');
  }
  if (Math.abs(rounded.e ?? 0) > MAX_OUTPUT_LENGTH - 2) throw new Error('计算结果过长');
  const resultText = rounded.toFixed();
  if (resultText.length > MAX_OUTPUT_LENGTH) throw new Error('计算结果过长');
  const roundedOrApproximate = divisionBased || !rounded.isEqualTo(result);
  return {
    operation,
    result: resultText,
    exact: !roundedOrApproximate,
    ...(operation === 'modulo' ? { semantics: 'truncated_remainder' as const } : {}),
    ...(operation === 'percentage_change'
      ? { formula: '((new_value - original_value) / original_value) * 100' }
      : {}),
    ...(roundedOrApproximate
      ? { precision: outputPrecision, rounding_mode: 'half_up' as const }
      : {}),
  };
}

function parseDecimal(value: string, Decimal: BigNumber.Constructor): BigNumber {
  if (!DECIMAL_PATTERN.test(value)) throw new Error(`不是有效十进制数：${value}`);
  const number = new Decimal(value);
  if (!number.isFinite() || Math.abs(number.e ?? 0) > MAX_INPUT_EXPONENT) {
    throw new Error(`数值指数不能超过 ${MAX_INPUT_EXPONENT}`);
  }
  return number;
}

function requireValueCount(values: BigNumber[], count: number, operation: string): void {
  if (values.length !== count) throw new Error(`${operation} 操作需要 ${count} 个数字`);
}

export function registerCalculatorTools(): void {
  toolRegistry.register({
    name: 'calculate',
    description:
      '执行高精度十进制基础数学计算，包括四则运算、幂、取余、平均值、极值、百分比、变化率和舍入。为避免 JSON 浮点精度损失，values 必须传十进制字符串，结果也返回字符串。除法类操作默认保留 20 位小数并标记 exact=false，可用 precision 指定 0-50 位和 half_up 舍入。',
    parameters: createToolParameter(
      {
        operation: {
          type: 'string',
          enum: [...OPERATIONS],
          description: '要执行的数学操作',
        },
        values: {
          type: 'array',
          items: {
            type: 'string',
            maxLength: 100,
            description: '十进制数字字符串，支持小数和科学计数法',
          },
          description: '参与计算的十进制数字字符串，顺序会影响减法、除法、幂、取余和百分比操作',
        },
        precision: {
          type: 'integer',
          minimum: 0,
          maximum: 50,
          description: '结果保留的小数位数，使用 half_up 舍入；除法类默认 20，round 默认 0',
        },
      },
      ['operation', 'values']
    ),
    handler: runCalculation as ToolHandler,
  });
}
