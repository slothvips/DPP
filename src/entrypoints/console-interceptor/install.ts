import {
  type ConsoleLogData,
  deepClone,
  emitConsoleEvent,
  generateConsoleLogId,
  getConsoleStack,
} from './shared';

const CONSOLE_RESTORE_EVENT = 'dpp-console-restore';
const CONSOLE_METHODS = ['log', 'info', 'warn', 'error', 'debug', 'trace'] as const;
type ConsoleMethod = (typeof CONSOLE_METHODS)[number];

export function installConsoleInterceptor() {
  const runtimeWindow = window as unknown as { __dppConsoleInterceptorInstalled?: boolean };
  if (runtimeWindow.__dppConsoleInterceptorInstalled) {
    return;
  }
  runtimeWindow.__dppConsoleInterceptorInstalled = true;

  const originalMethods: Record<ConsoleMethod, (...args: unknown[]) => void> = {} as Record<
    ConsoleMethod,
    (...args: unknown[]) => void
  >;

  for (const method of CONSOLE_METHODS) {
    originalMethods[method] = console[method].bind(console);

    console[method] = function (...args: unknown[]) {
      const result = originalMethods[method](...args);

      try {
        const logData: ConsoleLogData = {
          id: generateConsoleLogId(),
          level: method,
          args: args.map((arg, index) => deepClone(arg, `$[${index}]`)),
          timestamp: Date.now(),
        };

        if (method === 'trace' || method === 'error') {
          logData.stack = getConsoleStack();
        }

        emitConsoleEvent(logData);
      } catch {
        // ignore
      }

      return result;
    };
  }

  function restore() {
    try {
      for (const method of CONSOLE_METHODS) {
        if (originalMethods[method]) {
          console[method] = originalMethods[method];
        }
      }
    } catch {
      // ignore
    }

    try {
      runtimeWindow.__dppConsoleInterceptorInstalled = false;
    } catch {
      // ignore
    }
  }

  window.addEventListener(CONSOLE_RESTORE_EVENT, restore, { once: true });
}
