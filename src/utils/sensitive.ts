export const SENSITIVE_FIELD_PATTERN =
  /api[-_]?key|private[-_]?key|access[-_]?key|token|password|passwd|pwd|secret|credential/i;

export function isSensitiveFieldName(name: string): boolean {
  return SENSITIVE_FIELD_PATTERN.test(name);
}

export function redactSensitiveFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveFields(item));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [
      key,
      isSensitiveFieldName(key) ? '[redacted]' : redactSensitiveFields(entryValue),
    ])
  );
}

export function redactSensitiveJsonObject(json: string): string {
  try {
    const parsed = JSON.parse(json) as unknown;
    return JSON.stringify(redactSensitiveFields(parsed));
  } catch {
    return json.replace(
      /("(?:api[-_]?key|private[-_]?key|access[-_]?key|token|password|passwd|pwd|secret|credential)[^"]*"\s*:\s*)"[^"]*"/gi,
      '$1"[redacted]"'
    );
  }
}
