const PREFIX = '[DPP]';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

function createLogger(): Logger {
  const isDev = import.meta.env?.DEV ?? true;

  const log = (level: LogLevel, ...args: unknown[]) => {
    if (level === 'debug' && !isDev) return;

    const method = level === 'debug' ? 'log' : level;
    console[method](PREFIX, ...args);
  };

  return {
    debug: (...args) => log('debug', ...args),
    info: (...args) => log('info', ...args),
    warn: (...args) => log('warn', ...args),
    error: (...args) => log('error', ...args),
  };
}

export const logger = createLogger();
