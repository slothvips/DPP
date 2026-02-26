/**
 * 网络请求拦截脚本 - 注入到页面主世界执行
 * 此脚本会被打包为独立文件，通过 script 标签注入到页面
 *
 * 设计原则：
 * 1. 对主世界完全无感知 - 任何异常都不能影响原始 fetch/XHR 行为
 * 2. 保持原始 API 行为 - 返回值、异常、this 绑定都与原始一致
 * 3. 不产生副作用 - 不修改请求/响应内容
 * 4. 可完全恢复 - 停止录制时能还原所有被修改的全局对象
 * 5. 流式支持 - 请求开始即发送事件，支持流式响应捕获
 */

export default defineUnlistedScript(() => {
  // 防止重复注入
  if (
    (window as unknown as { __dppNetworkInterceptorInstalled?: boolean })
      .__dppNetworkInterceptorInstalled
  ) {
    return;
  }
  (
    window as unknown as { __dppNetworkInterceptorInstalled?: boolean }
  ).__dppNetworkInterceptorInstalled = true;

  // 网络请求事件名称
  const NETWORK_EVENT_NAME = 'dpp-network-request';
  // 恢复事件名称
  const NETWORK_RESTORE_EVENT = 'dpp-network-restore';

  // 敏感头部字段 - 不再脱敏，保留完整信息用于调试
  // const SENSITIVE_HEADERS = new Set([
  //   'authorization',
  //   'cookie',
  //   'set-cookie',
  //   'x-api-key',
  //   'x-auth-token',
  //   'x-access-token',
  // ]);

  // 流式响应的 Content-Type
  const STREAMING_CONTENT_TYPES = [
    'text/event-stream',
    'application/x-ndjson',
    'application/stream+json',
  ];

  // 流式事件节流配置
  const STREAM_THROTTLE_MS = 100; // 最小事件间隔
  const MAX_STREAM_CHUNKS = 1000; // 最大保留的 chunk 数量

  let requestIdCounter = 0;

  function generateRequestId(): string {
    return `net-${Date.now()}-${++requestIdCounter}`;
  }

  /**
   * 请求阶段类型
   */
  type NetworkRequestPhase =
    | 'start'
    | 'response-headers'
    | 'response-body'
    | 'complete'
    | 'error'
    | 'abort';

  /**
   * 流式响应数据块
   */
  interface StreamChunk {
    index: number;
    data: string;
    size: number;
    timestamp: number;
  }

  interface NetworkRequestData {
    id: string;
    type: 'fetch' | 'xhr' | 'sse';
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
    phase?: NetworkRequestPhase;
    isStreaming?: boolean;
    streamChunks?: StreamChunk[];
    receivedBytes?: number;
    totalBytes?: number;
  }

  /**
   * 安全地处理头部 - 不再脱敏，保留完整信息
   */
  function processHeaders(headers: Record<string, string>): Record<string, string> {
    try {
      return { ...headers };
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
   * 检查是否为流式响应类型
   */
  function isStreamingContentType(contentType: string): boolean {
    return STREAMING_CONTENT_TYPES.some((type) => contentType.includes(type));
  }

  /**
   * 安全地读取响应体 - 完整保留，不截断
   */
  async function safeReadResponseBody(response: Response, contentType: string): Promise<string> {
    try {
      const clonedResponse = response.clone();
      if (contentType.includes('application/json') || contentType.includes('text/')) {
        const text = await clonedResponse.text();
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

  /**
   * 流式读取响应体并发送增量事件（带节流）
   */
  async function streamResponseBody(
    response: Response,
    networkData: NetworkRequestData,
    contentType: string
  ): Promise<string> {
    const chunks: StreamChunk[] = [];
    let receivedBytes = 0;
    let chunkIndex = 0;
    const decoder = new TextDecoder();
    let fullBody = '';
    let lastEmitTime = 0;

    try {
      const clonedResponse = response.clone();
      const reader = clonedResponse.body?.getReader();

      if (!reader) {
        return safeReadResponseBody(response, contentType);
      }

      // 获取总大小（如果已知）
      const contentLength = response.headers.get('content-length');
      const totalBytes = contentLength ? parseInt(contentLength, 10) : undefined;

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        const chunkText = decoder.decode(value, { stream: true });
        const chunkSize = value.byteLength;
        receivedBytes += chunkSize;
        fullBody += chunkText;

        const chunk: StreamChunk = {
          index: chunkIndex++,
          data: chunkText,
          size: chunkSize,
          timestamp: Date.now(),
        };
        chunks.push(chunk);

        // 限制 chunks 数量，只保留最近的
        if (chunks.length > MAX_STREAM_CHUNKS) {
          chunks.shift();
        }

        // 节流：每 STREAM_THROTTLE_MS 毫秒最多发送一次事件
        const now = Date.now();
        if (now - lastEmitTime >= STREAM_THROTTLE_MS) {
          lastEmitTime = now;
          emitNetworkEvent({
            ...networkData,
            phase: 'response-body',
            isStreaming: true,
            streamChunks: [...chunks],
            receivedBytes,
            totalBytes,
            responseBody: fullBody,
          });
        }
      }

      return fullBody;
    } catch {
      return fullBody || '[Error reading stream]';
    }
  }

  // ==================== 拦截 fetch ====================

  const originalFetch = window.fetch;

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
      phase: 'start',
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
      networkData.requestHeaders = processHeaders(headers);
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

    // 立即发送请求开始事件
    emitNetworkEvent(networkData);

    try {
      // 调用原始 fetch，保持 this 绑定
      const response = await originalFetch.apply(this, [input, init]);

      // 安全地记录响应头信息
      try {
        networkData.status = response.status;
        networkData.statusText = response.statusText;
        networkData.responseHeaders = processHeaders(headersToObject(response.headers));

        const contentType = response.headers.get('content-type') || '';
        networkData.responseType = contentType;
        networkData.phase = 'response-headers';

        // 发送响应头事件
        emitNetworkEvent({ ...networkData });

        // 检查是否为流式响应
        const isStreaming = isStreamingContentType(contentType);

        if (isStreaming && response.body) {
          // 流式读取响应体
          networkData.isStreaming = true;
          networkData.responseBody = await streamResponseBody(response, networkData, contentType);
        } else {
          // 普通响应，一次性读取
          networkData.responseBody = await safeReadResponseBody(response, contentType);
        }

        networkData.endTime = Date.now();
        networkData.duration = networkData.endTime - startTime;
        networkData.phase = 'complete';
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
        networkData.phase = 'error';
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
    Object.setPrototypeOf(wrappedFetch, originalFetch);
  } catch {
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
          phase: 'abort',
        };
        emitNetworkEvent(networkData);
        this._dppNetworkData = undefined;
      }
    } catch {
      // ignore
    }

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

      // 立即发送请求开始事件
      emitNetworkEvent({
        id: data.id,
        type: 'xhr',
        method: data.method,
        url: data.url,
        startTime: data.startTime,
        requestHeaders: processHeaders(data.requestHeaders),
        requestBody: data.requestBody,
        phase: 'start',
      });

      // 监听 readystatechange 以捕获响应头
      const handleReadyStateChange = () => {
        try {
          if (!this._dppNetworkData) return;

          if (this.readyState === 2) {
            // HEADERS_RECEIVED
            const contentType = this.getResponseHeader('content-type') || '';
            emitNetworkEvent({
              id: data.id,
              type: 'xhr',
              method: data.method,
              url: data.url,
              status: this.status,
              statusText: this.statusText,
              startTime: data.startTime,
              requestHeaders: processHeaders(data.requestHeaders),
              responseHeaders: processHeaders(parseXHRHeaders(this.getAllResponseHeaders())),
              requestBody: data.requestBody,
              responseType: contentType,
              phase: 'response-headers',
            });
          }
        } catch {
          // ignore
        }
      };

      const handleLoadEnd = () => {
        try {
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
            requestHeaders: processHeaders(data.requestHeaders),
            responseHeaders: processHeaders(parseXHRHeaders(this.getAllResponseHeaders())),
            requestBody: data.requestBody,
            responseType: contentType,
            phase: 'complete',
          };

          // 安全地记录响应体
          try {
            if (this.responseType === '' || this.responseType === 'text') {
              networkData.responseBody = this.responseText;
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
            phase: 'error',
          };

          emitNetworkEvent(networkData);
        } catch {
          // ignore
        }
      };

      const handleTimeout = () => {
        try {
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
            phase: 'error',
          };

          emitNetworkEvent(networkData);
        } catch {
          // ignore
        }
      };

      try {
        this.addEventListener('readystatechange', handleReadyStateChange);
        this.addEventListener('loadend', handleLoadEnd, { once: true });
        this.addEventListener('error', handleError, { once: true });
        this.addEventListener('timeout', handleTimeout, { once: true });
      } catch {
        // ignore
      }
    }

    return originalXHRSend.call(this, body);
  };

  // ==================== 拦截 EventSource (SSE) ====================

  const OriginalEventSource = window.EventSource;

  if (OriginalEventSource) {
    class WrappedEventSource extends OriginalEventSource {
      private _dppId: string;
      private _dppStartTime: number;
      private _dppUrl: string;
      private _dppChunks: StreamChunk[] = [];
      private _dppChunkIndex = 0;
      private _dppReceivedBytes = 0;
      private _dppLastEmitTime = 0;

      constructor(url: string | URL, eventSourceInitDict?: EventSourceInit) {
        super(url, eventSourceInitDict);

        const urlStr = typeof url === 'string' ? url : url.href;

        // 忽略扩展相关请求
        if (isExtensionUrl(urlStr)) {
          this._dppId = '';
          this._dppStartTime = 0;
          this._dppUrl = '';
          return;
        }

        this._dppId = generateRequestId();
        this._dppStartTime = Date.now();
        this._dppUrl = urlStr;

        // 发送请求开始事件
        emitNetworkEvent({
          id: this._dppId,
          type: 'sse',
          method: 'GET',
          url: this._dppUrl,
          startTime: this._dppStartTime,
          phase: 'start',
          isStreaming: true,
        });

        // 监听连接打开
        this.addEventListener('open', () => {
          if (!this._dppId) return;
          emitNetworkEvent({
            id: this._dppId,
            type: 'sse',
            method: 'GET',
            url: this._dppUrl,
            startTime: this._dppStartTime,
            status: 200,
            statusText: 'OK',
            responseType: 'text/event-stream',
            phase: 'response-headers',
            isStreaming: true,
          });
        });

        // 监听消息
        this.addEventListener('message', (event: MessageEvent) => {
          if (!this._dppId) return;

          const messageData =
            typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
          const chunkSize = new Blob([messageData]).size;
          this._dppReceivedBytes += chunkSize;

          const chunk: StreamChunk = {
            index: this._dppChunkIndex++,
            data: messageData,
            size: chunkSize,
            timestamp: Date.now(),
          };
          this._dppChunks.push(chunk);

          // 限制 chunks 数量，只保留最近的
          if (this._dppChunks.length > MAX_STREAM_CHUNKS) {
            this._dppChunks.shift();
          }

          // 节流：每 STREAM_THROTTLE_MS 毫秒最多发送一次事件
          const now = Date.now();
          if (now - this._dppLastEmitTime >= STREAM_THROTTLE_MS) {
            this._dppLastEmitTime = now;
            emitNetworkEvent({
              id: this._dppId,
              type: 'sse',
              method: 'GET',
              url: this._dppUrl,
              startTime: this._dppStartTime,
              status: 200,
              responseType: 'text/event-stream',
              phase: 'response-body',
              isStreaming: true,
              streamChunks: [...this._dppChunks],
              receivedBytes: this._dppReceivedBytes,
              responseBody: this._dppChunks.map((c) => c.data).join('\n'),
            });
          }
        });

        // 监听错误
        this.addEventListener('error', () => {
          if (!this._dppId) return;

          const isComplete = this.readyState === EventSource.CLOSED;

          emitNetworkEvent({
            id: this._dppId,
            type: 'sse',
            method: 'GET',
            url: this._dppUrl,
            startTime: this._dppStartTime,
            endTime: Date.now(),
            duration: Date.now() - this._dppStartTime,
            status: isComplete ? 200 : undefined,
            responseType: 'text/event-stream',
            phase: isComplete ? 'complete' : 'error',
            error: isComplete ? undefined : 'SSE connection error',
            isStreaming: true,
            streamChunks: [...this._dppChunks],
            receivedBytes: this._dppReceivedBytes,
            responseBody: this._dppChunks.map((c) => c.data).join('\n'),
          });
        });
      }

      close() {
        if (this._dppId) {
          emitNetworkEvent({
            id: this._dppId,
            type: 'sse',
            method: 'GET',
            url: this._dppUrl,
            startTime: this._dppStartTime,
            endTime: Date.now(),
            duration: Date.now() - this._dppStartTime,
            status: 200,
            responseType: 'text/event-stream',
            phase: 'complete',
            isStreaming: true,
            streamChunks: [...this._dppChunks],
            receivedBytes: this._dppReceivedBytes,
            responseBody: this._dppChunks.map((c) => c.data).join('\n'),
          });
        }
        super.close();
      }
    }

    try {
      Object.defineProperty(window, 'EventSource', {
        value: WrappedEventSource,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    } catch {
      (window as unknown as { EventSource: typeof EventSource }).EventSource = WrappedEventSource;
    }
  }

  // ==================== 恢复机制 ====================

  function restore() {
    try {
      Object.defineProperty(window, 'fetch', {
        value: originalFetch,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    } catch {
      try {
        window.fetch = originalFetch;
      } catch {
        // ignore
      }
    }

    try {
      XMLHttpRequest.prototype.open = originalXHROpen;
      XMLHttpRequest.prototype.send = originalXHRSend;
      XMLHttpRequest.prototype.setRequestHeader = originalXHRSetRequestHeader;
      XMLHttpRequest.prototype.abort = originalXHRAbort;
    } catch {
      // ignore
    }

    // 恢复 EventSource
    if (OriginalEventSource) {
      try {
        Object.defineProperty(window, 'EventSource', {
          value: OriginalEventSource,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      } catch {
        try {
          (window as unknown as { EventSource: typeof EventSource }).EventSource =
            OriginalEventSource;
        } catch {
          // ignore
        }
      }
    }

    try {
      (
        window as unknown as { __dppNetworkInterceptorInstalled?: boolean }
      ).__dppNetworkInterceptorInstalled = false;
    } catch {
      // ignore
    }
  }

  window.addEventListener(NETWORK_RESTORE_EVENT, restore, { once: true });
});
