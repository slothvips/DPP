import { sanitizeNetworkCapture } from '../../utils/captureSanitize.ts';
import { redactSensitiveFields, redactSensitiveText } from '../../utils/sensitive.ts';
import { CONSOLE_PLUGIN_NAME, NETWORK_PLUGIN_NAME } from '../rrweb-plugins/names.ts';

/** 导出前再脱敏网络和 console 插件事件，避免旧录像把密钥原样写出。 */
export function redactRecordingEventsForExport(events: unknown[]): unknown[] {
  return events.map((event) => redactRecordingEvent(event));
}

function redactRecordingEvent(event: unknown): unknown {
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    return event;
  }

  const record = event as { type?: unknown; data?: unknown };
  if (record.type !== 6 || !record.data || typeof record.data !== 'object') {
    return event;
  }

  const data = record.data as { plugin?: unknown; payload?: unknown };
  if (data.plugin === NETWORK_PLUGIN_NAME) {
    return { ...record, data: { ...data, payload: redactNetworkPayload(data.payload) } };
  }
  if (data.plugin === CONSOLE_PLUGIN_NAME) {
    return { ...record, data: { ...data, payload: redactConsolePayload(data.payload) } };
  }
  return event;
}

function redactNetworkPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') return payload;
  const pluginPayload = payload as { data?: unknown };
  if (!pluginPayload.data || typeof pluginPayload.data !== 'object') return payload;
  const request = pluginPayload.data as { url?: unknown };
  if (typeof request.url !== 'string') return payload;
  return {
    ...pluginPayload,
    data: sanitizeNetworkCapture(request as { url: string }),
  };
}

function redactConsolePayload(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') return payload;
  const pluginPayload = payload as { data?: unknown };
  if (!pluginPayload.data || typeof pluginPayload.data !== 'object') return payload;
  const log = pluginPayload.data as { args?: unknown; stack?: unknown };
  return {
    ...pluginPayload,
    data: {
      ...log,
      ...(Array.isArray(log.args) ? { args: log.args.map((arg) => redactConsoleArg(arg)) } : {}),
      ...(typeof log.stack === 'string' ? { stack: redactSensitiveText(log.stack) } : {}),
    },
  };
}

function redactConsoleArg(arg: unknown): unknown {
  if (typeof arg === 'string') return redactSensitiveText(arg);
  return redactSensitiveFields(arg);
}
