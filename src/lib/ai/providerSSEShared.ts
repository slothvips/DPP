export function extractSSEEventBlocks(buffer: string): {
  events: string[];
  remainder: string;
} {
  const normalized = buffer.replace(/\r\n/g, '\n');
  const parts = normalized.split('\n\n');
  const remainder = parts.pop() ?? '';

  return {
    events: parts,
    remainder,
  };
}

export function getSSEDataPayload(eventBlock: string): string | null {
  const dataLines = eventBlock
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim());

  if (dataLines.length === 0) {
    return null;
  }

  return dataLines.join('\n');
}
