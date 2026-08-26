import type { OpenAIToolDefinition, ToolParameter, ToolProperty } from './types';

export const YOLO_MODE_KEY = '__dpp_yolo_mode';

export type ToolHandler<T = unknown> = (args: unknown) => Promise<T>;

export interface AIToolMetadata {
  name: string;
  description: string;
  parameters: ToolParameter;
  handler: ToolHandler;
  requiresConfirmation?: boolean;
}

export function toOpenAIToolDefinition(tool: AIToolMetadata): OpenAIToolDefinition {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  };
}

export function createToolParameter(
  properties: Record<string, ToolProperty>,
  required: string[] = []
): ToolParameter {
  return {
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  };
}

export function validateToolArguments(
  parameters: ToolParameter,
  args: Record<string, unknown>
): void {
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    throw new Error('arguments must be an object');
  }
  validateObject(args, parameters, 'arguments', true);
}

function validateObject(
  value: Record<string, unknown>,
  schema: ObjectSchema,
  path: string,
  allowInternalArguments = false
): void {
  for (const required of schema.required ?? []) {
    if (value[required] === undefined) throw new Error(`${path}.${required} is required`);
    if (typeof value[required] === 'string' && !value[required].trim()) {
      throw new Error(`${path}.${required} cannot be empty`);
    }
  }

  for (const [key, entry] of Object.entries(value)) {
    const property = schema.properties?.[key];
    if (!property) {
      if (
        schema.additionalProperties === false &&
        !(allowInternalArguments && isInternalToolArgument(key))
      ) {
        throw new Error(`${path}.${key} is not allowed`);
      }
      continue;
    }
    validateProperty(entry, property, `${path}.${key}`);
  }
}

interface ObjectSchema {
  additionalProperties?: boolean;
  properties?: Record<string, ToolProperty>;
  required?: string[];
}

function validateProperty(value: unknown, property: ToolProperty, path: string): void {
  switch (property.type) {
    case 'array':
      if (!Array.isArray(value)) throw new Error(`${path} must be an array`);
      if (property.items) {
        value.forEach((item, index) =>
          validateProperty(item, property.items!, `${path}[${index}]`)
        );
      }
      return;
    case 'boolean':
      if (typeof value !== 'boolean') throw new Error(`${path} must be a boolean`);
      return;
    case 'integer':
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        throw new Error(`${path} must be an integer`);
      }
      validateNumberBounds(value, property, path);
      return;
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`${path} must be a finite number`);
      }
      validateNumberBounds(value, property, path);
      return;
    case 'object':
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`${path} must be an object`);
      }
      validateObject(value as Record<string, unknown>, property, path);
      return;
    case 'string':
      if (typeof value !== 'string') throw new Error(`${path} must be a string`);
      if (property.enum && !property.enum.includes(value)) {
        throw new Error(`${path} must be one of: ${property.enum.join(', ')}`);
      }
      if (property.maxLength !== undefined && value.length > property.maxLength) {
        throw new Error(`${path} must be at most ${property.maxLength} characters`);
      }
  }
}

function validateNumberBounds(value: number, property: ToolProperty, path: string): void {
  if (property.minimum !== undefined && value < property.minimum) {
    throw new Error(`${path} must be at least ${property.minimum}`);
  }
  if (property.maximum !== undefined && value > property.maximum) {
    throw new Error(`${path} must be at most ${property.maximum}`);
  }
}

function isInternalToolArgument(key: string): boolean {
  return (
    key === 'session_id' || key === 'tool_call_id' || key === '__ownerType' || key === '__ownerId'
  );
}
