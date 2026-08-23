import type { OpenAIToolDefinition, ToolProperty } from '@/lib/ai/types';

export function parseBrowserTaskArguments(
  raw: string,
  tool: OpenAIToolDefinition
): Record<string, unknown> {
  const toolName = tool.function.name;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw || '{}') as unknown;
  } catch {
    throw new Error(`工具 ${toolName} 参数不是有效 JSON`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`工具 ${toolName} 参数无效`);
  }
  const args = parsed as Record<string, unknown>;
  const schema = tool.function.parameters;
  for (const key of schema.required || []) {
    if (!(key in args)) throw new Error(`工具 ${toolName} 缺少参数 ${key}`);
  }
  if (schema.additionalProperties === false) {
    const unknownKey = Object.keys(args).find((key) => !(key in schema.properties));
    if (unknownKey) throw new Error(`工具 ${toolName} 包含未知参数 ${unknownKey}`);
  }
  for (const [key, value] of Object.entries(args)) {
    const property = schema.properties[key];
    if (property) validateProperty(toolName, key, value, property);
  }
  return args;
}

function validateProperty(
  toolName: string,
  key: string,
  value: unknown,
  property: ToolProperty
): void {
  const validType =
    property.type === 'integer'
      ? Number.isInteger(value)
      : property.type === 'array'
        ? Array.isArray(value)
        : property.type === 'object'
          ? typeof value === 'object' && value !== null && !Array.isArray(value)
          : property.type === 'number'
            ? typeof value === 'number' && Number.isFinite(value)
            : typeof value === property.type;
  if (!validType) throw new Error(`工具 ${toolName} 参数 ${key} 必须是 ${property.type}`);
  if (typeof value === 'string') {
    if (!value) throw new Error(`工具 ${toolName} 参数 ${key} 不能为空`);
    if (property.enum && !property.enum.includes(value)) {
      throw new Error(`工具 ${toolName} 参数 ${key} 必须是 ${property.enum.join('、')}`);
    }
    if (property.maxLength !== undefined && value.length > property.maxLength) {
      throw new Error(`工具 ${toolName} 参数 ${key} 最多 ${property.maxLength} 个字符`);
    }
  }
  if (typeof value === 'number') {
    if (property.minimum !== undefined && value < property.minimum) {
      throw new Error(`工具 ${toolName} 参数 ${key} 不能小于 ${property.minimum}`);
    }
    if (property.maximum !== undefined && value > property.maximum) {
      throw new Error(`工具 ${toolName} 参数 ${key} 不能大于 ${property.maximum}`);
    }
  }
}

export function areBrowserUrlsEqual(left: string, right: string): boolean {
  try {
    return new URL(left).href === new URL(right).href;
  } catch {
    return left === right;
  }
}
