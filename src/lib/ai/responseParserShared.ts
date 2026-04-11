import { logger } from '@/utils/logger';

export interface ParsedToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ParseResult {
  type: 'tool_call' | 'text' | 'mixed';
  toolCalls?: ParsedToolCall[];
  text: string;
}

const JSON_BLOCK_REGEX = /```(?:json|javascript)?\s*\n?([\s\S]*?)\n?```/;
const JSON_BLOCK_REGEX_GLOBAL = /```(?:json|javascript)?\s*\n?[\s\S]*?\n?```/g;
const JSON_BLOCK_INNER_REGEX = /```(?:json|javascript)?\s*\n?([\s\S]*?)\n?```/;

export function extractJSONBlock(content: string): string | null {
  const match = content.match(JSON_BLOCK_REGEX);
  if (!match) {
    return null;
  }

  return match[1].trim();
}

export function extractAllJSONBlocks(content: string): string[] {
  const matches = content.match(JSON_BLOCK_REGEX_GLOBAL);
  if (!matches) {
    return [];
  }

  return matches.map((match) => {
    const innerMatch = match.match(JSON_BLOCK_INNER_REGEX);
    return innerMatch ? innerMatch[1].trim() : match;
  });
}

export function isValidToolCall(
  obj: unknown
): obj is { action: string; name: string; arguments: Record<string, unknown> } {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const record = obj as Record<string, unknown>;
  return (
    record.action === 'tool_call' &&
    typeof record.name === 'string' &&
    typeof record.arguments === 'object'
  );
}

export function parseToolCallsFromJSONBlock(jsonBlock: string): ParsedToolCall[] {
  try {
    const parsed = JSON.parse(jsonBlock);

    if (Array.isArray(parsed)) {
      return parsed.filter(isValidToolCall).map((item) => ({
        name: item.name,
        arguments: item.arguments,
      }));
    }

    if (isValidToolCall(parsed)) {
      return [
        {
          name: parsed.name,
          arguments: parsed.arguments,
        },
      ];
    }

    return [];
  } catch (error) {
    logger.debug('parseToolCallsFromJSONBlock parse error:', error);
    return [];
  }
}

export function stripJSONBlocks(content: string): string {
  return content.replace(JSON_BLOCK_REGEX_GLOBAL, '').trim();
}
