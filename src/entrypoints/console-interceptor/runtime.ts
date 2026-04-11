const CONSOLE_EVENT_NAME = 'dpp-console-log';

let logIdCounter = 0;

export interface ConsoleLogData {
  id: string;
  level: 'log' | 'info' | 'warn' | 'error' | 'debug' | 'trace';
  args: unknown[];
  timestamp: number;
  stack?: string;
}

export function generateConsoleLogId(): string {
  return `console-${Date.now()}-${++logIdCounter}`;
}

export function getConsoleStack(): string | undefined {
  try {
    const error = new Error();
    if (!error.stack) return undefined;
    return error.stack.split('\n').slice(3).join('\n');
  } catch {
    return undefined;
  }
}

export function emitConsoleEvent(data: ConsoleLogData) {
  try {
    window.dispatchEvent(
      new CustomEvent(CONSOLE_EVENT_NAME, {
        detail: data,
      })
    );
  } catch {
    // ignore
  }
}
