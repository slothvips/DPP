import { redactCapturedText, redactHeaders, sanitizeNetworkCapture } from '@/utils/captureSanitize';
import { NETWORK_EVENT_NAME, type NetworkRequestData, getNetworkChannelToken } from './types';

export function processHeaders(headers: Record<string, string>): Record<string, string> {
  try {
    return redactHeaders(headers);
  } catch {
    return {};
  }
}

export function headersToObject(headers: Headers): Record<string, string> {
  try {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  } catch {
    return {};
  }
}

export function parseXHRHeaders(headerString: string): Record<string, string> {
  try {
    if (!headerString) {
      return {};
    }

    const headers: Record<string, string> = {};
    headerString.split('\r\n').forEach((line) => {
      const separatorIndex = line.indexOf(': ');
      if (separatorIndex > 0) {
        headers[line.slice(0, separatorIndex)] = line.slice(separatorIndex + 2);
      }
    });
    return headers;
  } catch {
    return {};
  }
}

function serializeDocument(body: Document): string {
  try {
    return redactCapturedText(new XMLSerializer().serializeToString(body)).text;
  } catch {
    return '[Document]';
  }
}

export function serializeBody(body: BodyInit | Document | null | undefined): string | undefined {
  try {
    if (!body) return undefined;
    if (typeof body === 'string') return redactCapturedText(body).text;
    if (body instanceof Document) return serializeDocument(body);
    if (body instanceof URLSearchParams) return redactCapturedText(body.toString()).text;
    if (body instanceof FormData) {
      const parts: string[] = [];
      body.forEach((value, key) => {
        if (typeof value === 'string') {
          parts.push(`${key}=${value}`);
        } else {
          parts.push(`${key}=[File: ${value.name}]`);
        }
      });
      return redactCapturedText(parts.join('&')).text;
    }
    if (body instanceof Blob) {
      return `[Blob: ${body.size} bytes, type: ${body.type || 'unknown'}]`;
    }
    if (body instanceof ArrayBuffer) return `[ArrayBuffer: ${body.byteLength} bytes]`;
    if (ArrayBuffer.isView(body)) return `[TypedArray: ${body.byteLength} bytes]`;
    if (typeof ReadableStream !== 'undefined' && body instanceof ReadableStream) {
      return '[ReadableStream]';
    }
    return '[Unknown body type]';
  } catch {
    return '[Error serializing body]';
  }
}

export function emitNetworkEvent(data: NetworkRequestData) {
  try {
    window.dispatchEvent(
      new CustomEvent(NETWORK_EVENT_NAME, {
        detail: { channelToken: getNetworkChannelToken(), payload: sanitizeNetworkCapture(data) },
      })
    );
  } catch {
    // ignore
  }
}

export function isExtensionUrl(url: string): boolean {
  try {
    return url.startsWith('chrome-extension://') || url.startsWith('moz-extension://');
  } catch {
    return false;
  }
}

export function getUrlString(input: RequestInfo | URL): string {
  try {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.href;
    if (input instanceof Request) return input.url;
    return String(input);
  } catch {
    return '[Unknown URL]';
  }
}
