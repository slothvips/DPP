// Response parser for extracting tool calls from model output

export interface ParsedToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ParseResult {
  type: 'tool_call' | 'text' | 'mixed';
  toolCalls?: ParsedToolCall[];
  text: string;
}

/**
 * Extract a JSON code block from content
 * Supports both ```json and ```javascript code blocks
 */
export function extractJSONBlock(content: string): string | null {
  // Match JSON code block with optional language identifier
  const jsonBlockRegex = /```(?:json|javascript)?\s*\n?([\s\S]*?)\n?```/;
  const match = content.match(jsonBlockRegex);

  if (match) {
    return match[1].trim();
  }

  return null;
}

/**
 * Check if content contains any tool call
 */
export function containsToolCall(content: string): boolean {
  // Look for JSON code blocks with action: "tool_call"
  const jsonBlocks = extractAllJSONBlocks(content);
  if (jsonBlocks.length === 0) return false;

  try {
    // Check if any block is a valid tool call (single or array)
    return jsonBlocks.some((jsonBlock) => {
      const parsed = JSON.parse(jsonBlock);

      // Handle array of tool calls
      if (Array.isArray(parsed)) {
        return parsed.some((item) => isValidToolCall(item));
      }

      // Handle single tool call
      return isValidToolCall(parsed);
    });
  } catch {
    return false;
  }
}

/**
 * Extract all JSON code blocks from content
 */
function extractAllJSONBlocks(content: string): string[] {
  const jsonBlockRegex = /```(?:json|javascript)?\s*\n?([\s\S]*?)\n?```/g;
  const matches = content.match(jsonBlockRegex);
  if (!matches) return [];

  return matches.map((match) => {
    const jsonBlockRegexInner = /```(?:json|javascript)?\s*\n?([\s\S]*?)\n?```/;
    const innerMatch = match.match(jsonBlockRegexInner);
    return innerMatch ? innerMatch[1].trim() : match;
  });
}

/**
 * Extract and parse a tool call from content
 * Returns null if no valid tool call found
 */
export function extractToolCall(content: string): ParsedToolCall | null {
  const jsonBlock = extractJSONBlock(content);
  if (!jsonBlock) return null;

  try {
    const parsed = JSON.parse(jsonBlock);

    // Validate tool call format
    if (parsed.action !== 'tool_call') {
      return null;
    }

    if (!parsed.name || !parsed.arguments) {
      return null;
    }

    return {
      name: parsed.name,
      arguments: parsed.arguments,
    };
  } catch {
    return null;
  }
}

/**
 * Extract all tool calls from content
 * Returns empty array if no valid tool calls found
 * Handles both single tool call and array of tool calls
 */
export function extractToolCalls(content: string): ParsedToolCall[] {
  const jsonBlocks = extractAllJSONBlocks(content);
  const toolCalls: ParsedToolCall[] = [];

  for (const jsonBlock of jsonBlocks) {
    try {
      const parsed = JSON.parse(jsonBlock);

      // Handle array of tool calls
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (isValidToolCall(item)) {
            toolCalls.push({
              name: item.name,
              arguments: item.arguments,
            });
          }
        }
      }
      // Handle single tool call
      else if (isValidToolCall(parsed)) {
        toolCalls.push({
          name: parsed.name,
          arguments: parsed.arguments,
        });
      }
    } catch {
      continue;
    }
  }

  return toolCalls;
}

/**
 * Check if a parsed object is a valid tool call
 */
function isValidToolCall(
  obj: unknown
): obj is { action: string; name: string; arguments: Record<string, unknown> } {
  if (typeof obj !== 'object' || obj === null) return false;
  const o = obj as Record<string, unknown>;
  return o.action === 'tool_call' && typeof o.name === 'string' && typeof o.arguments === 'object';
}

/**
 * Parse model response content and extract tool call if present
 * Supports streaming - accumulates content and checks for complete JSON
 */
export function parseResponse(content: string): ParseResult {
  const toolCalls = extractToolCalls(content);

  if (toolCalls.length > 0) {
    // Remove all tool call JSON blocks from text, keep any additional text
    const text = content.replace(/```(?:json|javascript)?\s*\n?[\s\S]*?```/g, '').trim();

    // If there's text alongside the tool call, it's mixed
    // Otherwise it's purely a tool call
    const type = text ? 'mixed' : 'tool_call';

    return {
      type,
      toolCalls,
      text,
    };
  }

  // No tool call found
  return {
    type: 'text',
    text: content,
  };
}
