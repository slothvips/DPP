import { formatJsonText, minifyJsonText } from '@/features/toolbox/components/JsonTool/jsonUtils';
import { arrayBufferToBase64, base64ToArrayBuffer } from '@/utils/base64';
import { type ToolHandler, createToolParameter, toolRegistry } from '../tools';

const OPERATIONS = [
  'uuid',
  'random_integer',
  'sha256',
  'sha384',
  'sha512',
  'base64_encode',
  'base64_decode',
  'url_encode',
  'url_decode',
  'json_validate',
  'json_format',
  'json_minify',
  'text_stats',
] as const;
const HASH_ALGORITHMS = {
  sha256: 'SHA-256',
  sha384: 'SHA-384',
  sha512: 'SHA-512',
} as const;
const UINT32_RANGE = 0x1_0000_0000;

type DeveloperUtilityOperation = (typeof OPERATIONS)[number];

interface DeveloperUtilityArgs {
  operation: DeveloperUtilityOperation;
  input?: string;
  min?: number;
  max?: number;
  count?: number;
  locale?: string;
}

export async function runDeveloperUtility(args: DeveloperUtilityArgs): Promise<unknown> {
  switch (args.operation) {
    case 'uuid':
      return {
        operation: args.operation,
        values: Array.from({ length: args.count ?? 1 }, () => crypto.randomUUID()),
      };
    case 'random_integer':
      return {
        operation: args.operation,
        values: secureRandomIntegers(args.min ?? 0, args.max ?? 100, args.count ?? 1),
      };
    case 'sha256':
    case 'sha384':
    case 'sha512':
      return hashText(requireInput(args.input), HASH_ALGORITHMS[args.operation]);
    case 'base64_encode': {
      const input = requireWellFormedUnicode(requireInput(args.input));
      return {
        operation: args.operation,
        output: arrayBufferToBase64(new TextEncoder().encode(input).buffer),
      };
    }
    case 'base64_decode':
      return {
        operation: args.operation,
        output: new TextDecoder('utf-8', { fatal: true }).decode(
          base64ToArrayBuffer(requireInput(args.input))
        ),
      };
    case 'url_encode':
      return { operation: args.operation, output: encodeURIComponent(requireInput(args.input)) };
    case 'url_decode':
      return { operation: args.operation, output: decodeURIComponent(requireInput(args.input)) };
    case 'json_validate':
      return validateJson(requireInput(args.input));
    case 'json_format':
      return {
        operation: args.operation,
        output: requireJsonOutput(formatJsonText(requireInput(args.input))),
      };
    case 'json_minify':
      return {
        operation: args.operation,
        output: requireJsonOutput(minifyJsonText(requireInput(args.input))),
      };
    case 'text_stats':
      return getTextStats(requireInput(args.input), args.locale);
  }
}

function requireInput(input: string | undefined): string {
  if (input === undefined) throw new Error('此操作需要 input');
  return input;
}

function requireJsonOutput(output: string | null): string {
  if (output === null) throw new Error('JSON 输入不能为空');
  return output;
}

function requireWellFormedUnicode(input: string): string {
  for (let index = 0; index < input.length; index += 1) {
    const codeUnit = input.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = input.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        throw new Error('input 包含未配对的 Unicode 代理项');
      }
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      throw new Error('input 包含未配对的 Unicode 代理项');
    }
  }
  return input;
}

function secureRandomIntegers(min: number, max: number, count: number): number[] {
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max)) {
    throw new Error('min 和 max 必须是安全整数');
  }
  if (min > max) throw new Error('min 不能大于 max');
  const range = max - min + 1;
  if (!Number.isSafeInteger(range) || range > UINT32_RANGE) {
    throw new Error('随机整数范围不能超过 2^32');
  }
  const limit = Math.floor(UINT32_RANGE / range) * range;
  const values: number[] = [];
  const random = new Uint32Array(1);
  while (values.length < count) {
    crypto.getRandomValues(random);
    if (random[0] < limit) values.push(min + (random[0] % range));
  }
  return values;
}

async function hashText(
  input: string,
  algorithm: (typeof HASH_ALGORITHMS)[keyof typeof HASH_ALGORITHMS]
) {
  const digest = await crypto.subtle.digest(
    algorithm,
    new TextEncoder().encode(requireWellFormedUnicode(input))
  );
  return {
    operation: algorithm.toLowerCase().replace('-', ''),
    algorithm,
    hex: Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(''),
  };
}

function validateJson(input: string) {
  try {
    const value = JSON.parse(input) as unknown;
    return {
      operation: 'json_validate',
      valid: true,
      value_type: value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value,
    };
  } catch (error) {
    return {
      operation: 'json_validate',
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid JSON',
    };
  }
}

function getTextStats(input: string, locale?: string) {
  requireWellFormedUnicode(input);
  const graphemeSegmenter = new Intl.Segmenter(locale, { granularity: 'grapheme' });
  const wordSegmenter = new Intl.Segmenter(locale, { granularity: 'word' });
  const graphemes = Array.from(graphemeSegmenter.segment(input), (segment) => segment.segment);
  const words = Array.from(wordSegmenter.segment(input)).filter(
    (segment) => segment.isWordLike
  ).length;
  return {
    operation: 'text_stats',
    locale: wordSegmenter.resolvedOptions().locale,
    graphemes: graphemes.length,
    graphemes_without_whitespace: graphemes.filter((value) => !/^\s+$/u.test(value)).length,
    code_points: Array.from(input).length,
    utf16_code_units: input.length,
    words,
    lines: input.length === 0 ? 0 : input.split(/\r\n|\r|\n/).length,
    utf8_bytes: new TextEncoder().encode(input).byteLength,
    word_definition: 'Intl.Segmenter word-like segments',
    line_definition: 'empty text is 0 lines; otherwise CRLF, CR, and LF are separators',
  };
}

export function registerDeveloperUtilityTools(): void {
  toolRegistry.register({
    name: 'developer_utility',
    description:
      '执行本地开发者常用操作：生成 UUID 或安全随机整数、SHA-256/384/512 哈希、UTF-8 Base64 编解码、URL 组件编解码、JSON 校验/格式化/压缩，以及 Unicode 文本统计。不会执行代码。',
    parameters: createToolParameter(
      {
        operation: {
          type: 'string',
          enum: [...OPERATIONS],
          description: '要执行的开发者工具操作',
        },
        input: {
          type: 'string',
          maxLength: 50_000,
          description: '哈希、编解码、JSON 或文本统计的输入；生成操作不需要',
        },
        min: { type: 'integer', description: '随机整数最小值，默认 0' },
        max: { type: 'integer', description: '随机整数最大值，默认 100' },
        count: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          description: 'UUID 或随机整数生成数量，默认 1',
        },
        locale: {
          type: 'string',
          maxLength: 50,
          description: '文本分词使用的可选 BCP 47 语言标记',
        },
      },
      ['operation']
    ),
    handler: runDeveloperUtility as ToolHandler,
  });
}
