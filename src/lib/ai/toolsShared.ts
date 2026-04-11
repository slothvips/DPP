import type { OpenAIToolDefinition, ToolParameter } from './types';

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
  properties: Record<string, { type: string; description: string; enum?: string[] }>,
  required: string[] = []
): ToolParameter {
  return {
    type: 'object',
    properties,
    required,
  };
}
