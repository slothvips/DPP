import {
  emitSseCloseEvent,
  emitSseErrorEvent,
  emitSseMessageEvent,
  emitSseOpenEvent,
  emitSseStartEvent,
} from './sseEvents';
import { type SseRuntimeState, createSseRuntimeState } from './sseShared';
import { isExtensionUrl } from './utils';

export function installEventSourceInterceptor(): () => void {
  const OriginalEventSource = window.EventSource;

  if (!OriginalEventSource) {
    return () => {};
  }

  class WrappedEventSource extends OriginalEventSource {
    private _dppState: SseRuntimeState | null = null;

    constructor(url: string | URL, eventSourceInitDict?: EventSourceInit) {
      super(url, eventSourceInitDict);

      const resolvedUrl = typeof url === 'string' ? url : url.href;
      if (isExtensionUrl(resolvedUrl)) {
        return;
      }

      this._dppState = createSseRuntimeState(resolvedUrl);
      emitSseStartEvent(this._dppState);

      this.addEventListener('open', () => {
        if (!this._dppState) {
          return;
        }

        emitSseOpenEvent(this._dppState);
      });

      this.addEventListener('message', (event: MessageEvent) => {
        if (!this._dppState) {
          return;
        }

        emitSseMessageEvent(this._dppState, event);
      });

      this.addEventListener('error', () => {
        if (!this._dppState) {
          return;
        }

        emitSseErrorEvent(this._dppState, this.readyState === EventSource.CLOSED);
      });
    }

    close() {
      if (this._dppState) {
        emitSseCloseEvent(this._dppState);
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

  return () => {
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
  };
}
