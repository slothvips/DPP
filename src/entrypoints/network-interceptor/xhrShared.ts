import type { NetworkRequestData } from './types';

export interface XhrNetworkData {
  id: string;
  method: string;
  url: string;
  startTime: number;
  requestHeaders: Record<string, string>;
  requestBody?: string;
}

export interface ExtendedXHR extends XMLHttpRequest {
  _dppNetworkData?: XhrNetworkData;
}

export function createXhrStartEvent(
  data: XhrNetworkData,
  requestHeaders: Record<string, string>
): NetworkRequestData {
  return {
    id: data.id,
    type: 'xhr',
    method: data.method,
    url: data.url,
    startTime: data.startTime,
    requestHeaders,
    requestBody: data.requestBody,
    phase: 'start',
  };
}

export function createXhrTerminalEvent(
  data: XhrNetworkData,
  error: string,
  phase: 'abort' | 'error'
): NetworkRequestData {
  const endTime = Date.now();

  return {
    id: data.id,
    type: 'xhr',
    method: data.method,
    url: data.url,
    startTime: data.startTime,
    endTime,
    duration: endTime - data.startTime,
    requestBody: data.requestBody,
    aborted: phase === 'abort' ? true : undefined,
    error,
    phase,
  };
}

export function resolveXhrResponseBody(xhr: XMLHttpRequest, contentType: string): string {
  try {
    if (xhr.responseType === '' || xhr.responseType === 'text') {
      return xhr.responseText;
    }
    if (xhr.responseType === 'json') {
      return JSON.stringify(xhr.response, null, 2);
    }
    if (xhr.responseType === 'document' && xhr.responseXML) {
      return new XMLSerializer().serializeToString(xhr.responseXML);
    }
    if (xhr.responseType === 'blob' && xhr.response instanceof Blob) {
      return `[Blob: ${xhr.response.size} bytes, type: ${contentType}]`;
    }
    if (xhr.responseType === 'arraybuffer' && xhr.response instanceof ArrayBuffer) {
      return `[ArrayBuffer: ${xhr.response.byteLength} bytes]`;
    }
    return `[${xhr.responseType || 'Unknown'} response]`;
  } catch {
    return '[Unable to read response body]';
  }
}
