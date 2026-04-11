export function validateJsonText(value: string): string | null {
  if (!value.trim()) {
    return null;
  }

  try {
    JSON.parse(value);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Invalid JSON';
  }
}

export function formatJsonText(value: string): string | null {
  if (!value.trim()) return null;
  const parsed = JSON.parse(value);
  return JSON.stringify(parsed, null, 2);
}

export function minifyJsonText(value: string): string | null {
  if (!value.trim()) return null;
  const parsed = JSON.parse(value);
  return JSON.stringify(parsed);
}

export function extractJsonFromText(text: string): string | null {
  let cleaned = text
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .replace(/<thinking>[\s\S]*$/gi, '')
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
    .replace(/<reasoning>[\s\S]*$/gi, '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*$/gi, '')
    .trim();

  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    const extracted = codeBlockMatch[1].trim();
    try {
      JSON.parse(extracted);
      return extracted;
    } catch {
      // Continue trying other extraction strategies.
    }
  }

  const jsonBlockMatch = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jsonBlockMatch) {
    const extracted = jsonBlockMatch[1].trim();
    try {
      JSON.parse(extracted);
      return extracted;
    } catch {
      // Continue trying other extraction strategies.
    }
  }

  cleaned = cleaned.replace(/^[\s\S]*?(?=\{|\[)/, '');
  const lastEnd = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
  if (lastEnd > 0) {
    cleaned = cleaned.substring(0, lastEnd + 1);
  }

  try {
    JSON.parse(cleaned);
    return cleaned;
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');

    let start = firstBrace;
    let end = lastBrace;
    if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
      start = firstBracket;
      end = lastBracket;
    }

    if (start !== -1 && end !== -1 && end > start) {
      const candidate = cleaned.slice(start, end + 1);
      try {
        JSON.parse(candidate);
        return candidate;
      } catch {
        // Continue trying other extraction strategies.
      }
    }
  }

  return null;
}
