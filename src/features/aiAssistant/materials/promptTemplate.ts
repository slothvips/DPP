import type { PromptVariable } from './testCaseTypes';

const PROMPT_VARIABLE_PATTERN = /{{\s*([A-Za-z_][A-Za-z0-9_]*)\s*}}/g;

export function extractPromptVariableKeys(body: string): string[] {
  const keys = new Set<string>();
  for (const match of body.matchAll(PROMPT_VARIABLE_PATTERN)) {
    const key = match[1];
    if (key) keys.add(key);
  }
  return [...keys];
}

export function renderPromptTemplate(
  body: string,
  variables: PromptVariable[],
  values: Readonly<Record<string, string>>
): string {
  const variableMap = new Map(variables.map((variable) => [variable.key, variable]));
  return body.replace(PROMPT_VARIABLE_PATTERN, (placeholder, key: string) => {
    const variable = variableMap.get(key);
    if (!variable) return placeholder;

    const value = values[key] ?? variable.defaultValue ?? '';
    if (variable.required && !value.trim()) {
      throw new Error(`请填写变量“${variable.label}”`);
    }
    return value;
  });
}
