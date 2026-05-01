import { logger } from '@/utils/logger';
import type { OpenAIToolCall } from './types';

export function mergeStreamedValue(current: string, next?: string): string {
  if (!next) {
    return current;
  }
  if (!current) {
    return next;
  }
  if (current === next) {
    return current;
  }
  if (next.startsWith(current)) {
    return next;
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

  const parsed = parseToolArgumentsJson(trimmed);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Tool arguments must be a JSON object');
  }

  return JSON.stringify(parsed);
}

export function normalizeToolArgumentsJsonOrOriginal(input: string): string {
  try {
    return normalizeToolArgumentsJson(input);
  } catch {
    return input.trim() || '{}';
  }
}

export function normalizeToolArgumentsJsonForRequest(input: string): string {
  try {
    return normalizeToolArgumentsJson(input);
  } catch (error) {
    logger.warn(
      '[AIProvider] Failed to normalize tool arguments for request; using empty object',
      error
    );
    return '{}';
  }
}

function parseToolArgumentsJson(input: string): unknown {
  try {
    return parseToolArgumentsJsonCandidate(input);
  } catch (error) {
    let lastError: unknown = error;

    for (const candidate of buildToolArgumentsJsonCandidates(input)) {
      try {
        return parseToolArgumentsJsonCandidate(candidate);
      } catch (candidateError) {
        lastError = candidateError;
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Invalid tool arguments JSON');
  }
}

function parseToolArgumentsJsonCandidate(input: string): unknown {
  const parsed = JSON.parse(input) as unknown;
  return typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
}

function buildToolArgumentsJsonCandidates(input: string): string[] {
  const stripped = stripJsonCodeFence(input.trim());
  const repaired = repairToolArgumentsJson(stripped);

  return Array.from(new Set([stripped, repaired]));
}

function stripJsonCodeFence(input: string): string {
  const match = input.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : input;
}

function repairToolArgumentsJson(input: string): string {
  let repaired = input
    .replace(/，/g, ',')
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/([}\]])\s*("[-_a-zA-Z0-9]+"\s*:)/g, '$1,$2')
    .replace(/("|\d|true|false|null)\s*("[-_a-zA-Z0-9]+"\s*:)/g, '$1,$2');

  repaired = repaired.replace(/([{,]\s*)([-_a-zA-Z][-_a-zA-Z0-9]*)\s*:/g, '$1"$2":');

  return closeUnbalancedJsonDelimiters(repaired);
}

function closeUnbalancedJsonDelimiters(input: string): string {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (const char of input) {
    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = inString;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === '{') {
      stack.push('}');
    } else if (char === '[') {
      stack.push(']');
    } else if (char === '}' || char === ']') {
      if (stack.at(-1) === char) {
        stack.pop();
      }
    }
  }

  return input + stack.reverse().join('');
}
