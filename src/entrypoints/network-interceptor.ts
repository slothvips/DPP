/**
 * 网络请求拦截脚本 - 注入到页面主世界执行
 * 此脚本会被打包为独立文件，通过 script 标签注入到页面
 *
 * 设计原则：
 * 1. 对主世界完全无感知 - 任何异常都不能影响原始 fetch/XHR 行为
 * 2. 保持原始 API 行为 - 返回值、异常、this 绑定都与原始一致
 * 3. 不产生副作用 - 不修改请求/响应内容
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

  /**
   * 安全地脱敏头部 - 不会抛出异常
   */
  function maskSensitiveHeaders(headers: Record<string, string>): Record<string, string> {
    try {
      const masked: Record<string, string> = {};
      for (const [key, value] of Object.entries(headers)) {
        masked[key] = SENSITIVE_HEADERS.has(key.toLowerCase()) ? '[REDACTED]' : value;
      }
      return masked;
    } catch {
      return {};
    }
  }

  /**
   * 安全地将 Headers 对象转换为普通对象
   */
  function headersToObject(headers: Headers): Record<string, string> {
    try {
      const obj: Record<string, string> = {};
      headers.forEach((value, key) => {
        obj[key] = value;
      });
      return obj;
    } catch {
      return {};
    }
  }

  /**
   * 安全地解析 XHR 头部字符串
   */
  function parseXHRHeaders(headerString: string): Record<string, string> {
    try {
      const headers: Record<string, string> = {};
      if (!headerString) return headers;
      headerString.split('\r\n').forEach((line) => {
        const idx = line.indexOf(': ');
        if (idx > 0) {
          headers[line.slice(0, idx)] = line.slice(idx + 2);
        }
      });
      return headers;
    } catch {
      return {};
    }
  }

  /**
   * 安全地序列化请求体 - 不会抛出异常
   */
  function serializeBody(body: BodyInit | null | undefined): string | undefined {
    try {
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
      if (body instanceof Blob)
        return `[Blob: ${body.size} bytes, type: ${body.type || 'unknown'}]`;
      if (body instanceof ArrayBuffer) return `[ArrayBuffer: ${body.byteLength} bytes]`;
      if (ArrayBuffer.isView(body)) return `[TypedArray: ${body.byteLength} bytes]`;
      // ReadableStream
      if (typeof ReadableStream !== 'undefined' && body instanceof ReadableStream) {
        return '[ReadableStream]';
      }
      return '[Unknown body type]';
    } catch {
      return '[Error serializing body]';
    }
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
    aborted?: boolean;
  }

  /**
   * 安全地发送网络事件 - 不会抛出异常
   */
  function emitNetworkEvent(data: NetworkRequestData) {
    try {
      window.dispatchEvent(
        new CustomEvent(NETWORK_EVENT_NAME, {
          detail: data,
        })
      );
    } catch {
      // 静默失败，不影响主世界
    }
  }

  /**
   * 检查是否为扩展相关 URL
   */
  function isExtensionUrl(url: string): boolean {
    try {
      return url.startsWith('chrome-extension://') || url.startsWith('moz-extension://');
    } catch {
      return false;
    }
  }

  /**
   * 安全地获取 URL 字符串
   */
  function getUrlString(input: RequestInfo | URL): string {
    try {
      if (typeof input === 'string') return input;
      if (input instanceof URL) return input.href;
      if (input instanceof Request) return input.url;
      return String(input);
    } catch {
      return '[Unknown URL]';
    }
  }

  /**
   * 安全地读取响应体
   */
  async function safeReadResponseBody(response: Response, contentType: string): Promise<string> {
    try {
      const clonedResponse = response.clone();
      if (contentType.includes('application/json') || contentType.includes('text/')) {
        const text = await clonedResponse.text();
        // 限制响应体大小
        if (text.length > 100000) {
          return text.slice(0, 100000) + `... [truncated, total ${text.length} chars]`;
        }
        return text;
      } else if (
        contentType.includes('image/') ||
        contentType.includes('audio/') ||
        contentType.includes('video/')
      ) {
        const blob = await clonedResponse.blob();
        return `[Binary: ${blob.size} bytes, type: ${contentType}]`;
      } else {
        return `[${contentType || 'Unknown type'}]`;
      }
    } catch {
      return '[Unable to read response body]';
    }
  }

  // ==================== 拦截 fetch ====================

  const originalFetch = window.fetch;

  // 使用 Object.defineProperty 确保属性描述符与原始一致
  const wrappedFetch = async function (
    this: typeof globalThis,
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const url = getUrlString(input);

    // 忽略扩展相关请求
    if (isExtensionUrl(url)) {
      return originalFetch.apply(this, [input, init]);
    }

    const requestId = generateRequestId();
    const startTime = Date.now();

    const networkData: NetworkRequestData = {
      id: requestId,
      type: 'fetch',
      method: 'GET',
      url,
      startTime,
    };

    // 安全地获取请求方法
    try {
      if (init?.method) {
        networkData.method = init.method.toUpperCase();
      } else if (input instanceof Request) {
        networkData.method = input.method.toUpperCase();
      }
    } catch {
      // ignore
    }

    // 安全地记录请求头
    try {
      let headers: Record<string, string> = {};
      if (init?.headers) {
        if (init.headers instanceof Headers) {
          headers = headersToObject(init.headers);
        } else if (Array.isArray(init.headers)) {
          headers = Object.fromEntries(init.headers);
        } else {
          headers = init.headers as Record<string, string>;
        }
      } else if (input instanceof Request) {
        headers = headersToObject(input.headers);
      }
      networkData.requestHeaders = maskSensitiveHeaders(headers);
    } catch {
      // ignore
    }

    // 安全地记录请求体
    try {
      if (init?.body) {
        networkData.requestBody = serializeBody(init.body);
      } else if (input instanceof Request && input.body) {
        networkData.requestBody = '[Request body - cannot read without consuming]';
      }
    } catch {
      // ignore
    }

    try {
      // 调用原始 fetch，保持 this 绑定
      const response = await originalFetch.apply(this, [input, init]);

      // 安全地记录响应信息
      try {
        networkData.endTime = Date.now();
        networkData.duration = networkData.endTime - startTime;
        networkData.status = response.status;
        networkData.statusText = response.statusText;
        networkData.responseHeaders = maskSensitiveHeaders(headersToObject(response.headers));

        const contentType = response.headers.get('content-type') || '';
        networkData.responseType = contentType;
        networkData.responseBody = await safeReadResponseBody(response, contentType);
      } catch {
        // ignore
      }

      emitNetworkEvent(networkData);
      return response;
    } catch (error) {
      // 安全地记录错误信息
      try {
        networkData.endTime = Date.now();
        networkData.duration = networkData.endTime - startTime;
        networkData.error = error instanceof Error ? error.message : String(error);
      } catch {
        // ignore
      }

      emitNetworkEvent(networkData);
      throw error; // 重新抛出原始错误
    }
  };

  // 保持原始 fetch 的属性（如 length, name）
  try {
    Object.defineProperty(window, 'fetch', {
      value: wrappedFetch,
      writable: true,
      configurable: true,
      enumerable: true,
    });
    // 复制原始 fetch 的静态属性
    Object.setPrototypeOf(wrappedFetch, originalFetch);
  } catch {
    // 降级：直接赋值
    window.fetch = wrappedFetch as typeof fetch;
  }

  // ==================== 拦截 XHR ====================

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
  const originalXHRAbort = XMLHttpRequest.prototype.abort;

  XMLHttpRequest.prototype.open = function (
    this: ExtendedXHR,
    method: string,
    url: string | URL,
    async: boolean = true,
    username?: string | null,
    password?: string | null
  ) {
    try {
      const urlStr = url.toString();

      // 忽略扩展相关请求
      if (!isExtensionUrl(urlStr)) {
        this._dppNetworkData = {
          id: generateRequestId(),
          method: method.toUpperCase(),
          url: urlStr,
          startTime: Date.now(),
          requestHeaders: {},
        };
      }
    } catch {
      // ignore
    }

    // 始终调用原始方法
    return originalXHROpen.call(this, method, url, async, username, password);
  };

  XMLHttpRequest.prototype.setRequestHeader = function (
    this: ExtendedXHR,
    name: string,
    value: string
  ) {
    try {
      if (this._dppNetworkData) {
        this._dppNetworkData.requestHeaders[name] = value;
      }
    } catch {
      // ignore
    }

    // 始终调用原始方法
    return originalXHRSetRequestHeader.call(this, name, value);
  };

  XMLHttpRequest.prototype.abort = function (this: ExtendedXHR) {
    try {
      const data = this._dppNetworkData;
      if (data) {
        const networkData: NetworkRequestData = {
          id: data.id,
          type: 'xhr',
          method: data.method,
          url: data.url,
          startTime: data.startTime,
          endTime: Date.now(),
          duration: Date.now() - data.startTime,
          requestBody: data.requestBody,
          aborted: true,
          error: 'Request aborted',
        };
        emitNetworkEvent(networkData);
        // 清除数据，避免重复发送
        this._dppNetworkData = undefined;
      }
    } catch {
      // ignore
    }

    // 始终调用原始方法
    return originalXHRAbort.call(this);
  };

  XMLHttpRequest.prototype.send = function (
    this: ExtendedXHR,
    body?: Document | XMLHttpRequestBodyInit | null
  ) {
    const data = this._dppNetworkData;

    if (data) {
      // 安全地记录请求体
      try {
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
            try {
              data.requestBody = new XMLSerializer().serializeToString(body);
            } catch {
              data.requestBody = '[Document]';
            }
          } else {
            data.requestBody = '[Unknown body type]';
          }
        }
      } catch {
        // ignore
      }

      const handleLoadEnd = () => {
        try {
          // 检查是否已被 abort 处理
          if (!this._dppNetworkData) return;

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

          // 安全地记录响应体
          try {
            if (this.responseType === '' || this.responseType === 'text') {
              const text = this.responseText;
              if (text.length > 100000) {
                networkData.responseBody =
                  text.slice(0, 100000) + `... [truncated, total ${text.length} chars]`;
              } else {
                networkData.responseBody = text;
              }
            } else if (this.responseType === 'json') {
              networkData.responseBody = JSON.stringify(this.response, null, 2);
            } else if (this.responseType === 'document' && this.responseXML) {
              networkData.responseBody = new XMLSerializer().serializeToString(this.responseXML);
            } else if (this.responseType === 'blob' && this.response instanceof Blob) {
              networkData.responseBody = `[Blob: ${this.response.size} bytes, type: ${contentType}]`;
            } else if (
              this.responseType === 'arraybuffer' &&
              this.response instanceof ArrayBuffer
            ) {
              networkData.responseBody = `[ArrayBuffer: ${this.response.byteLength} bytes]`;
            } else {
              networkData.responseBody = `[${this.responseType || 'Unknown'} response]`;
            }
          } catch {
            networkData.responseBody = '[Unable to read response body]';
          }

          emitNetworkEvent(networkData);
        } catch {
          // ignore
        }
      };

      const handleError = () => {
        try {
          // 检查是否已被 abort 处理
          if (!this._dppNetworkData) return;

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
        } catch {
          // ignore
        }
      };

      const handleTimeout = () => {
        try {
          // 检查是否已被 abort 处理
          if (!this._dppNetworkData) return;

          const networkData: NetworkRequestData = {
            id: data.id,
            type: 'xhr',
            method: data.method,
            url: data.url,
            startTime: data.startTime,
            endTime: Date.now(),
            duration: Date.now() - data.startTime,
            requestBody: data.requestBody,
            error: 'Request timeout',
          };

          emitNetworkEvent(networkData);
        } catch {
          // ignore
        }
      };

      // 使用 try-catch 包装事件监听
      try {
        this.addEventListener('loadend', handleLoadEnd, { once: true });
        this.addEventListener('error', handleError, { once: true });
        this.addEventListener('timeout', handleTimeout, { once: true });
      } catch {
        // ignore
      }
    }

    // 始终调用原始方法
    return originalXHRSend.call(this, body);
  };
});
