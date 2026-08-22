import { normalizeOpenCodeModel } from '../ai/openCodeProviderShared.ts';
import type { OpenAIChatRequest } from '../ai/types.ts';

const UNSUPPORTED_SCHEMA_KEYS = new Set(['$schema', 'additionalProperties', 'strict']);

function stripUnsupportedSchemaKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripUnsupportedSchemaKeys);
  }

  if (typeof value !== 'object' || value === null) {
    return value;
  }

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (UNSUPPORTED_SCHEMA_KEYS.has(key)) continue;
    if (key === 'properties' && typeof entry === 'object' && entry !== null) {
      result[key] = Object.fromEntries(
        Object.entries(entry).map(([propertyName, propertySchema]) => [
          propertyName,
          stripUnsupportedSchemaKeys(propertySchema),
        ])
      );
      continue;
    }
    result[key] = stripUnsupportedSchemaKeys(entry);
  }
  return result;
}

export function normalizeOpenCodePageAgentRequest(request: OpenAIChatRequest): OpenAIChatRequest {
  const normalized: OpenAIChatRequest = {
    ...request,
    tools: request.tools?.map((tool) => ({
      ...tool,
      function: {
        ...tool.function,
        parameters: stripUnsupportedSchemaKeys(
          tool.function.parameters
        ) as typeof tool.function.parameters,
      },
    })),
  };

  return {
    model: normalizeOpenCodeModel(normalized.model),
    messages: normalized.messages,
    tools: normalized.tools,
    tool_choice: normalized.tool_choice,
    stream: true,
  };
}
