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
    const method = level === 'debug' ? 'log' : level;
    console[method](PREFIX, ...args);
  };

  // 开发环境:全部级别输出
  if (isDev) {
    return {
      debug: (...args) => log('debug', ...args),
      info: (...args) => log('info', ...args),
      warn: (...args) => log('warn', ...args),
      error: (...args) => log('error', ...args),
    };
  }

  // 生产环境:仅保留 warn/error,便于线上问题排查
  // debug/info 静默以避免日志噪声和潜在的信息泄漏
  return {
    debug: () => {},
    info: () => {},
    warn: (...args) => log('warn', ...args),
    error: (...args) => log('error', ...args),
  };
}

export const logger = createLogger();
