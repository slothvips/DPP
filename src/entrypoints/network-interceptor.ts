/**
 * 网络请求拦截脚本 - 注入到页面主世界执行
 * 此脚本会被打包为独立文件，通过 script 标签注入到页面
 */

export default defineUnlistedScript(() => {
  // 网络请求事件名称
  const NETWORK_EVENT_NAME = 'dpp-network-request';

  // 敏感头部字段
  const SENSITIVE_HEADERS = new Set([
    'authorization',
    'cookie',
    'set-cookie',
    'x-api-key',
    'x-auth-token',
    'x-access-token',
  ]);

  let requestIdCounter = 0;

  function generateRequestId(): string {
    return `net-${Date.now()}-${++requestIdCounter}`;
  }

  function maskSensitiveHeaders(headers: Record<string, string>): Record<string, string> {
    const masked: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      masked[key] = SENSITIVE_HEADERS.has(key.toLowerCase()) ? '[REDACTED]' : value;
    }
    return masked;
  }

  function headersToObject(headers: Headers): Record<string, string> {
    const obj: Record<string, string> = {};
    headers.forEach((value, key) => {
      obj[key] = value;
    });
    return obj;
  }

  function parseXHRHeaders(headerString: string): Record<string, string> {
    const headers: Record<string, string> = {};
    if (!headerString) return headers;
    headerString.split('\r\n').forEach((line) => {
      const idx = line.indexOf(': ');
      if (idx > 0) {
        headers[line.slice(0, idx)] = line.slice(idx + 2);
      }
    });
    return headers;
  }

  function serializeBody(body: BodyInit | null | undefined): string | undefined {
    if (!body) return undefined;
    if (typeof body === 'string') return body;
    if (body instanceof URLSearchParams) return body.toString();
    if (body instanceof FormData) {
      const parts: string[] = [];
      body.forEach((value, key) => {
        if (typeof value === 'string') {
          parts.push(`${key}=${value}`);
        } else {
          parts.push(`${key}=[File: ${value.name}]`);
        }
      });
      return parts.join('&');
    }
    if (body instanceof Blob) return `[Blob: ${body.size} bytes, type: ${body.type || 'unknown'}]`;
    if (body instanceof ArrayBuffer) return `[ArrayBuffer: ${body.byteLength} bytes]`;
    if (ArrayBuffer.isView(body)) return `[TypedArray: ${body.byteLength} bytes]`;
    return '[Unknown body type]';
  }

  interface NetworkRequestData {
    id: string;
    type: 'fetch' | 'xhr';
    method: string;
    url: string;
    status?: number;
    statusText?: string;
    requestHeaders?: Record<string, string>;
    responseHeaders?: Record<string, string>;
    requestBody?: string;
    responseBody?: string;
    responseType?: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    error?: string;
  }

  function emitNetworkEvent(data: NetworkRequestData) {
    window.dispatchEvent(
      new CustomEvent(NETWORK_EVENT_NAME, {
        detail: data,
      })
    );
  }

  // 拦截 fetch
  const originalFetch = window.fetch;
  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

    // 忽略扩展相关请求
    if (url.startsWith('chrome-extension://') || url.startsWith('moz-extension://')) {
      return originalFetch.apply(this, [input, init]);
    }

    const requestId = generateRequestId();
    const startTime = Date.now();

    const networkData: NetworkRequestData = {
      id: requestId,
      type: 'fetch',
      method: init?.method?.toUpperCase() || 'GET',
      url,
      startTime,
    };

    // 记录请求头
    if (init?.headers) {
      const headers =
        init.headers instanceof Headers
          ? headersToObject(init.headers)
          : Array.isArray(init.headers)
            ? Object.fromEntries(init.headers)
            : (init.headers as Record<string, string>);
      networkData.requestHeaders = maskSensitiveHeaders(headers);
    }

    // 记录请求体
    if (init?.body) {
      networkData.requestBody = serializeBody(init.body);
    }

    try {
      const response = await originalFetch.apply(this, [input, init]);

      networkData.endTime = Date.now();
      networkData.duration = networkData.endTime - startTime;
      networkData.status = response.status;
      networkData.statusText = response.statusText;
      networkData.responseHeaders = maskSensitiveHeaders(headersToObject(response.headers));

      // 记录响应体 - 需要克隆 response
      const contentType = response.headers.get('content-type') || '';
      networkData.responseType = contentType;

      try {
        const clonedResponse = response.clone();
        if (contentType.includes('application/json') || contentType.includes('text/')) {
          const text = await clonedResponse.text();
          networkData.responseBody = text;
        } else if (
          contentType.includes('image/') ||
          contentType.includes('audio/') ||
          contentType.includes('video/')
        ) {
          const blob = await clonedResponse.blob();
          networkData.responseBody = `[Binary: ${blob.size} bytes, type: ${contentType}]`;
        } else {
          networkData.responseBody = `[${contentType || 'Unknown type'}]`;
        }
      } catch {
        networkData.responseBody = '[Unable to read response body]';
      }

      emitNetworkEvent(networkData);
      return response;
    } catch (error) {
      networkData.endTime = Date.now();
      networkData.duration = networkData.endTime - startTime;
      networkData.error = error instanceof Error ? error.message : String(error);

      emitNetworkEvent(networkData);
      throw error;
    }
  };

  // 拦截 XHR
  interface ExtendedXHR extends XMLHttpRequest {
    _dppNetworkData?: {
      id: string;
      method: string;
      url: string;
      startTime: number;
      requestHeaders: Record<string, string>;
      requestBody?: string;
    };
  }

  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;
  const originalXHRSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

  XMLHttpRequest.prototype.open = function (
    this: ExtendedXHR,
    method: string,
    url: string | URL,
    async: boolean = true,
    username?: string | null,
    password?: string | null
  ) {
    const urlStr = url.toString();

    // 忽略扩展相关请求
    if (!urlStr.startsWith('chrome-extension://') && !urlStr.startsWith('moz-extension://')) {
      this._dppNetworkData = {
        id: generateRequestId(),
        method: method.toUpperCase(),
        url: urlStr,
        startTime: Date.now(),
        requestHeaders: {},
      };
    }

    return originalXHROpen.call(this, method, url, async, username, password);
  };

  XMLHttpRequest.prototype.setRequestHeader = function (
    this: ExtendedXHR,
    name: string,
    value: string
  ) {
    if (this._dppNetworkData) {
      this._dppNetworkData.requestHeaders[name] = value;
    }
    return originalXHRSetRequestHeader.call(this, name, value);
  };

  XMLHttpRequest.prototype.send = function (
    this: ExtendedXHR,
    body?: Document | XMLHttpRequestBodyInit | null
  ) {
    const data = this._dppNetworkData;

    if (data) {
      // 记录请求体
      if (body) {
        if (typeof body === 'string') {
          data.requestBody = body;
        } else if (body instanceof FormData) {
          const parts: string[] = [];
          body.forEach((value, key) => {
            if (typeof value === 'string') {
              parts.push(`${key}=${value}`);
            } else {
              parts.push(`${key}=[File: ${value.name}]`);
            }
          });
          data.requestBody = parts.join('&');
        } else if (body instanceof URLSearchParams) {
          data.requestBody = body.toString();
        } else if (body instanceof Blob) {
          data.requestBody = `[Blob: ${body.size} bytes]`;
        } else if (body instanceof ArrayBuffer) {
          data.requestBody = `[ArrayBuffer: ${body.byteLength} bytes]`;
        } else if (body instanceof Document) {
          data.requestBody = new XMLSerializer().serializeToString(body);
        } else {
          data.requestBody = '[Unknown body type]';
        }
      }

      const handleLoadEnd = () => {
        const contentType = this.getResponseHeader('content-type') || '';

        const networkData: NetworkRequestData = {
          id: data.id,
          type: 'xhr',
          method: data.method,
          url: data.url,
          status: this.status,
          statusText: this.statusText,
          startTime: data.startTime,
          endTime: Date.now(),
          duration: Date.now() - data.startTime,
          requestHeaders: maskSensitiveHeaders(data.requestHeaders),
          responseHeaders: maskSensitiveHeaders(parseXHRHeaders(this.getAllResponseHeaders())),
          requestBody: data.requestBody,
          responseType: contentType,
        };

        // 记录响应体
        try {
          if (this.responseType === '' || this.responseType === 'text') {
            networkData.responseBody = this.responseText;
          } else if (this.responseType === 'json') {
            networkData.responseBody = JSON.stringify(this.response, null, 2);
          } else if (this.responseType === 'document' && this.responseXML) {
            networkData.responseBody = new XMLSerializer().serializeToString(this.responseXML);
          } else if (this.responseType === 'blob' && this.response instanceof Blob) {
            networkData.responseBody = `[Blob: ${this.response.size} bytes, type: ${contentType}]`;
          } else if (this.responseType === 'arraybuffer' && this.response instanceof ArrayBuffer) {
            networkData.responseBody = `[ArrayBuffer: ${this.response.byteLength} bytes]`;
          } else {
            networkData.responseBody = `[${this.responseType || 'Unknown'} response]`;
          }
        } catch {
          networkData.responseBody = '[Unable to read response body]';
        }

        emitNetworkEvent(networkData);
      };

      const handleError = () => {
        const networkData: NetworkRequestData = {
          id: data.id,
          type: 'xhr',
          method: data.method,
          url: data.url,
          startTime: data.startTime,
          endTime: Date.now(),
          duration: Date.now() - data.startTime,
          requestBody: data.requestBody,
          error: 'Network error',
        };

        emitNetworkEvent(networkData);
      };

      this.addEventListener('loadend', handleLoadEnd, { once: true });
      this.addEventListener('error', handleError, { once: true });
    }

    return originalXHRSend.call(this, body);
  };
});
