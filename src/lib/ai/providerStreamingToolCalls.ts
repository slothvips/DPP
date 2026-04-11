import type { OpenAIToolCall } from './types';

export function mergeStreamedValue(current: string, next?: string): string {
  if (!next) {
    return current;
  }
  if (!current) {
    return next;
  }
  if (next.startsWith(current)) {
    return next;
  }
  if (current.endsWith(next)) {
    return current;
  }
  return current + next;
}

export function resolveStreamingToolCallKey(
  partialToolCall: { id?: string; index?: number },
  toolCallLookup: Map<string, OpenAIToolCall>,
  toolCallKeyByIndex: Map<number, string>
): string {
  if (partialToolCall.id) {
    if (partialToolCall.index !== undefined) {
      const existingKey = toolCallKeyByIndex.get(partialToolCall.index);
      if (existingKey && existingKey !== partialToolCall.id) {
        const existingToolCall = toolCallLookup.get(existingKey);
        if (existingToolCall && !toolCallLookup.has(partialToolCall.id)) {
          toolCallLookup.set(partialToolCall.id, existingToolCall);
        }
        toolCallLookup.delete(existingKey);
      }
      toolCallKeyByIndex.set(partialToolCall.index, partialToolCall.id);
    }
    return partialToolCall.id;
  }

  if (partialToolCall.index !== undefined) {
    const existingKey = toolCallKeyByIndex.get(partialToolCall.index);
    if (existingKey) {
      return existingKey;
    }

    const indexKey = String(partialToolCall.index);
    toolCallKeyByIndex.set(partialToolCall.index, indexKey);
    return indexKey;
  }

  return String(toolCallLookup.size);
}

export function normalizeToolArgumentsJson(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return '{}';
  }

  const parsed = JSON.parse(trimmed) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Tool arguments must be a JSON object');
  }

  return JSON.stringify(parsed);
}
