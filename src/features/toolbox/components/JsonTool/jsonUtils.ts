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
  JSON.parse(value);
  return rewriteJsonWhitespace(value, true);
}

export function minifyJsonText(value: string): string | null {
  if (!value.trim()) return null;
  JSON.parse(value);
  return rewriteJsonWhitespace(value, false);
}

function rewriteJsonWhitespace(value: string, pretty: boolean): string {
  let output = '';
  let indent = 0;
  let inString = false;
  let escaped = false;
  const expandedContainers: boolean[] = [];

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (inString) {
      output += character;
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      output += character;
      continue;
    }
    if (/\s/.test(character)) continue;
    if (!pretty) {
      output += character;
      continue;
    }
    if (character === '{' || character === '[') {
      output += character;
      const closing = character === '{' ? '}' : ']';
      const expanded = getNextNonWhitespace(value, index + 1) !== closing;
      expandedContainers.push(expanded);
      if (expanded) {
        indent += 1;
        output += `\n${'  '.repeat(indent)}`;
      }
      continue;
    }
    if (character === '}' || character === ']') {
      if (expandedContainers.pop()) {
        indent -= 1;
        output += `\n${'  '.repeat(indent)}`;
      }
      output += character;
      continue;
    }
    if (character === ',') {
      output += `,\n${'  '.repeat(indent)}`;
      continue;
    }
    output += character === ':' ? ': ' : character;
  }

  return output;
}

function getNextNonWhitespace(value: string, start: number): string | undefined {
  for (let index = start; index < value.length; index += 1) {
    if (!/\s/.test(value[index])) return value[index];
  }
  return undefined;
}

class JsonNumber {
  readonly value: string;

  constructor(value: string) {
    this.value = value;
  }
}

/** Parse only repairs that cannot change JSON values or field names. */
export function parseConservativeJson(value: string): unknown | null {
  const candidates = [value, removeTrailingJsonCommas(value)];
  for (const candidate of candidates) {
    try {
      return parseJsonPreservingNumbers(candidate);
    } catch {
      // Try the next conservative candidate.
    }
  }
  return null;
}

function parseJsonPreservingNumbers(value: string): unknown {
  const parser = new ConservativeJsonParser(value);
  const parsed = parser.parseValue();
  parser.skipWhitespace();
  if (!parser.isAtEnd()) throw new Error('Unexpected JSON content');
  return parsed;
}

class ConservativeJsonParser {
  private index = 0;
  private readonly value: string;

  constructor(value: string) {
    this.value = value;
  }

  parseValue(): unknown {
    this.skipWhitespace();
    const character = this.value[this.index];
    if (character === '"') return this.parseString();
    if (character === '{') return this.parseObject();
    if (character === '[') return this.parseArray();
    if (character === '-' || this.isDigit(character)) return this.parseNumber();
    if (this.consumeLiteral('true')) return true;
    if (this.consumeLiteral('false')) return false;
    if (this.consumeLiteral('null')) return null;
    throw new Error('Invalid JSON value');
  }

  skipWhitespace(): void {
    while (isJsonWhitespace(this.value[this.index])) this.index += 1;
  }

  isAtEnd(): boolean {
    return this.index >= this.value.length;
  }

  private parseObject(): Record<string, unknown> {
    this.index += 1;
    const result: Record<string, unknown> = {};
    this.skipWhitespace();
    if (this.value[this.index] === '}') {
      this.index += 1;
      return result;
    }

    while (true) {
      this.skipWhitespace();
      if (this.value[this.index] !== '"') throw new Error('Invalid JSON object key');
      const key = this.parseString();
      this.skipWhitespace();
      this.expect(':');
      result[key] = this.parseValue();
      this.skipWhitespace();
      if (this.value[this.index] === '}') {
        this.index += 1;
        return result;
      }
      this.expect(',');
    }
  }

  private parseArray(): unknown[] {
    this.index += 1;
    const result: unknown[] = [];
    this.skipWhitespace();
    if (this.value[this.index] === ']') {
      this.index += 1;
      return result;
    }

    while (true) {
      result.push(this.parseValue());
      this.skipWhitespace();
      if (this.value[this.index] === ']') {
        this.index += 1;
        return result;
      }
      this.expect(',');
    }
  }

  private parseString(): string {
    const start = this.index;
    this.index += 1;
    let escaped = false;
    while (!this.isAtEnd()) {
      const character = this.value[this.index];
      this.index += 1;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (character === '\\') {
        escaped = true;
        continue;
      }
      if (character === '"') {
        return JSON.parse(this.value.slice(start, this.index)) as string;
      }
    }
    throw new Error('Unterminated JSON string');
  }

  private parseNumber(): number | JsonNumber {
    const remaining = this.value.slice(this.index);
    const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(remaining);
    if (!match) throw new Error('Invalid JSON number');
    const source = match[0];
    this.index += source.length;
    const numeric = Number(source);
    if (Number.isFinite(numeric) && (!Number.isInteger(numeric) || Number.isSafeInteger(numeric))) {
      return numeric;
    }
    return new JsonNumber(canonicalizeInteger(source));
  }

  private consumeLiteral(literal: string): boolean {
    if (!this.value.startsWith(literal, this.index)) return false;
    this.index += literal.length;
    return true;
  }

  private expect(character: string): void {
    if (this.value[this.index] !== character) throw new Error(`Expected ${character}`);
    this.index += 1;
  }

  private isDigit(character: string | undefined): boolean {
    return character !== undefined && character >= '0' && character <= '9';
  }
}

function isJsonWhitespace(character: string | undefined): boolean {
  return character === ' ' || character === '\n' || character === '\r' || character === '\t';
}

function canonicalizeInteger(source: string): string {
  if (!/^-?\d+$/.test(source) || source === '-0') return source;
  try {
    return BigInt(source).toString();
  } catch {
    return source;
  }
}

function removeTrailingJsonCommas(value: string): string {
  let output = '';
  let inString = false;
  let escaped = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (inString) {
      output += character;
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      output += character;
      continue;
    }
    if (character === ',') {
      const next = getNextNonWhitespace(value, index + 1);
      if (next === '}' || next === ']') continue;
    }
    output += character;
  }
  return output;
}

export function areJsonValuesEqual(left: unknown, right: unknown): boolean {
  if (left instanceof JsonNumber || right instanceof JsonNumber) {
    return left instanceof JsonNumber && right instanceof JsonNumber && left.value === right.value;
  }
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((value, index) => areJsonValuesEqual(value, right[index]));
  }
  if (
    !left ||
    !right ||
    typeof left !== 'object' ||
    typeof right !== 'object' ||
    Object.getPrototypeOf(left) !== Object.getPrototypeOf(right)
  ) {
    return false;
  }
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord).sort();
  const rightKeys = Object.keys(rightRecord).sort();
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] && areJsonValuesEqual(leftRecord[key], rightRecord[key])
    )
  );
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
