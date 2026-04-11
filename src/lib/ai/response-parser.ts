// Response parser for extracting tool calls from model output
import {
  type ParseResult,
  type ParsedToolCall,
  extractAllJSONBlocks,
  extractJSONBlock,
  isValidToolCall,
  parseToolCallsFromJSONBlock,
  stripJSONBlocks,
} from './responseParserShared';

export type { ParseResult, ParsedToolCall } from './responseParserShared';

/**
 * Extract a JSON code block from content
 * Supports both ```json and ```javascript code blocks
 */
export { extractJSONBlock };

/**
 * Check if content contains any tool call
 */
export function containsToolCall(content: string): boolean {
  const jsonBlocks = extractAllJSONBlocks(content);
  return jsonBlocks.some((jsonBlock) => parseToolCallsFromJSONBlock(jsonBlock).length > 0);
}

/**
 * Extract and parse a tool call from content
 * Returns null if no valid tool call found
 */
export function extractToolCall(content: string): ParsedToolCall | null {
  const jsonBlock = extractJSONBlock(content);
  if (!jsonBlock) {
    return null;
  }

  const [toolCall] = parseToolCallsFromJSONBlock(jsonBlock);
  return toolCall ?? null;
}

/**
 * Extract all tool calls from content
 * Returns empty array if no valid tool calls found
 * Handles both single tool call and array of tool calls
 */
export function extractToolCalls(content: string): ParsedToolCall[] {
  return extractAllJSONBlocks(content).flatMap((jsonBlock) =>
    parseToolCallsFromJSONBlock(jsonBlock)
  );
}

/**
 * Parse model response content and extract tool call if present
 * Supports streaming - accumulates content and checks for complete JSON
 */
export function parseResponse(content: string): ParseResult {
  const toolCalls = extractToolCalls(content);

  if (toolCalls.length === 0) {
    return {
      type: 'text',
      text: content,
    };
  }

  const text = stripJSONBlocks(content);
  const type = text ? 'mixed' : 'tool_call';

  return {
    type,
    toolCalls,
    text,
  };
}

export { isValidToolCall };
