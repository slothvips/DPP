import { record } from 'rrweb';
import {
  CONSOLE_PLUGIN_NAME,
  type ConsolePluginEvent,
  NETWORK_PLUGIN_NAME,
  type NetworkPluginEvent,
} from '@/lib/rrweb-plugins';
import { logger } from '@/utils/logger';
import { pack } from '@rrweb/packer';
import type { eventWithTime } from '@rrweb/types';

// 网络请求事件名称，与注入脚本保持一致
const NETWORK_EVENT_NAME = 'dpp-network-request';
// 控制台日志事件名称，与注入脚本保持一致
const CONSOLE_EVENT_NAME = 'dpp-console-log';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    let stopFn: (() => void) | undefined | null = null;
    let events: eventWithTime[] = [];
    let startTime = 0;
    let uiContainer: HTMLDivElement | null = null;
    let timerInterval: number | null = null;
    let networkEventHandler: ((e: Event) => void) | null = null;
    let consoleEventHandler: ((e: Event) => void) | null = null;
    let injectedScript: HTMLScriptElement | null = null;
    let injectedConsoleScript: HTMLScriptElement | null = null;

    // Check if recording is active when content script loads
    browser.runtime.sendMessage({ type: 'RECORDER_GET_STATUS_FOR_CONTENT' }).then((response) => {
      if (response?.isRecording) {
        startTime = response.startTime || Date.now();
        events = [];

        startRecording(true);
      }
    });

    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'RECORDER_INJECT') {
        startRecording();
      }
      if (message.type === 'RECORDER_STOP_CAPTURE') {
        stopRecording();
      }
      if (message.type === 'RECORDER_PING') {
        sendResponse({ success: true });
        return true;
      }
    });

    function createFloatingUI() {
      if (uiContainer) return;

      const host = document.createElement('div');
      host.className = 'dpp-recorder-host rr-ignore';
      Object.assign(host.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: '2147483647',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      });

      const shadow = host.attachShadow({ mode: 'open' });

      const style = document.createElement('style');
      style.textContent = `
        .container {
          background: white;
          padding: 10px 14px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          display: flex;
          align-items: center;
          gap: 10px;
          border: 1px solid #e5e7eb;
          font-size: 14px;
          color: #374151;
          cursor: move;
          user-select: none;
        }
        .indicator {
          display: flex;
          align-items: center;
          gap: 6px;
          pointer-events: none;
        }
        .dot {
          width: 8px;
          height: 8px;
          background: #ef4444;
          border-radius: 50%;
          animation: pulse 1.5s infinite;
        }
        .timer {
          font-variant-numeric: tabular-nums;
          font-weight: 500;
        }
        .stop-btn {
          background: #fee2e2;
          color: #b91c1c;
          border: 1px solid #fecaca;
          padding: 4px 10px;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
          margin-left: 4px;
          transition: background 0.2s;
        }
        .stop-btn:hover {
          background: #fecaca;
        }
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `;

      const container = document.createElement('div');
      container.className = 'container';

      // Drag functionality
      let isDragging = false;
      let currentX = 0;
      let currentY = 0;
      let initialX = 0;
      let initialY = 0;
      let xOffset = 0;
      let yOffset = 0;

      container.addEventListener('mousedown', dragStart);
      document.addEventListener('mousemove', drag);
      document.addEventListener('mouseup', dragEnd);

      function dragStart(e: MouseEvent) {
        if ((e.target as HTMLElement).tagName === 'BUTTON') return;
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;
        isDragging = true;
      }

      function drag(e: MouseEvent) {
        if (isDragging) {
          e.preventDefault();
          currentX = e.clientX - initialX;
          currentY = e.clientY - initialY;
          xOffset = currentX;
          yOffset = currentY;
          setTranslate(currentX, currentY, host);
        }
      }

      function setTranslate(xPos: number, yPos: number, el: HTMLElement) {
        el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
      }

      function dragEnd() {
        initialX = currentX;
        initialY = currentY;
        isDragging = false;
      }

      // Clean up event listeners when removing UI
      interface DraggableHost extends HTMLElement {
        _cleanupDrag?: () => void;
      }
      (host as DraggableHost)._cleanupDrag = () => {
        document.removeEventListener('mousemove', drag);
        document.removeEventListener('mouseup', dragEnd);
      };

      const indicator = document.createElement('div');
      indicator.className = 'indicator';
      indicator.innerHTML = `
        <div class="dot"></div>
        <span class="timer">00:00</span>
      `;

      const stopBtn = document.createElement('button');
      stopBtn.className = 'stop-btn';
      stopBtn.textContent = 'Stop Recording';
      stopBtn.onclick = (e) => {
        e.stopPropagation();
        stopRecording();
      };

      container.appendChild(indicator);
      container.appendChild(stopBtn);
      shadow.appendChild(style);
      shadow.appendChild(container);

      document.body.appendChild(host);
      uiContainer = host;

      const timerEl = indicator.querySelector('.timer');
      if (timerEl) {
        timerInterval = window.setInterval(() => {
          const diff = Date.now() - startTime;
          const seconds = Math.floor(diff / 1000);
          const m = Math.floor(seconds / 60)
            .toString()
            .padStart(2, '0');
          const s = (seconds % 60).toString().padStart(2, '0');
          timerEl.textContent = `${m}:${s}`;
        }, 1000);
      }
    }

    function removeFloatingUI() {
      if (uiContainer) {
        interface DraggableHost extends HTMLElement {
          _cleanupDrag?: () => void;
        }
        const host = uiContainer as DraggableHost;
        if (host._cleanupDrag) {
          host._cleanupDrag();
        }
        uiContainer.remove();
        uiContainer = null;
      }
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
    }

    function startRecording(isResume = false) {
      if (stopFn) return;
      events = [];
      if (!isResume) {
        startTime = Date.now();
      }
      logger.debug('Starting rrweb recording');

      createFloatingUI();
      injectNetworkInterceptor();
      injectConsoleInterceptor();

      stopFn = record({
        packFn: pack,
        emit(event) {
          events.push(event);
        },
        checkoutEveryNms: 5000,
        blockClass: 'rr-block',
        blockSelector: 'video, audio, [data-player], .bilibili-player-video',
        ignoreClass: 'rr-ignore',
        maskTextClass: 'rr-mask',
        maskAllInputs: true,
      });
    }

    function stopRecording() {
      if (stopFn) {
        stopFn();
        stopFn = null;
        removeFloatingUI();
        removeNetworkInterceptor();
        removeConsoleInterceptor();
        const duration = Date.now() - startTime;
        logger.debug('Stopped rrweb recording', { duration, events: events.length });

        const faviconEl = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
        const favicon = faviconEl?.href;

        browser.runtime.sendMessage({
          type: 'RECORDER_COMPLETE',
          events,
          url: window.location.href,
          favicon,
          duration,
        });

        events = [];
      }
    }

    /**
     * 注入网络拦截脚本到页面主世界
     */
    function injectNetworkInterceptor() {
      // 监听来自页面的网络事件
      networkEventHandler = (e: Event) => {
        const customEvent = e as CustomEvent;
        const networkData = customEvent.detail;

        // 创建 rrweb 插件事件格式
        const pluginEvent: eventWithTime = {
          type: 6, // EventType.Plugin
          data: {
            plugin: NETWORK_PLUGIN_NAME,
            payload: {
              type: 'network',
              data: networkData,
              timestamp: Date.now(),
            } as NetworkPluginEvent,
          },
          timestamp: Date.now(),
        };

        events.push(pluginEvent);
      };

      window.addEventListener(NETWORK_EVENT_NAME, networkEventHandler);

      // 注入脚本到页面主世界
      injectedScript = document.createElement('script');
      injectedScript.src = browser.runtime.getURL('/network-interceptor.js' as '/popup.html');
      injectedScript.onload = () => {
        logger.debug('Network interceptor injected');
      };
      injectedScript.onerror = (err) => {
        logger.error('Failed to inject network interceptor', err);
      };
      (document.head || document.documentElement).appendChild(injectedScript);
    }

    /**
     * 移除网络拦截
     */
    function removeNetworkInterceptor() {
      if (networkEventHandler) {
        window.removeEventListener(NETWORK_EVENT_NAME, networkEventHandler);
        networkEventHandler = null;
      }
      if (injectedScript) {
        injectedScript.remove();
        injectedScript = null;
      }
    }

    /**
     * 注入控制台拦截脚本到页面主世界
     */
    function injectConsoleInterceptor() {
      // 监听来自页面的控制台事件
      consoleEventHandler = (e: Event) => {
        const customEvent = e as CustomEvent;
        const consoleData = customEvent.detail;

        // 创建 rrweb 插件事件格式
        const pluginEvent: eventWithTime = {
          type: 6, // EventType.Plugin
          data: {
            plugin: CONSOLE_PLUGIN_NAME,
            payload: {
              type: 'console',
              data: consoleData,
              timestamp: Date.now(),
            } as ConsolePluginEvent,
          },
          timestamp: Date.now(),
        };

        events.push(pluginEvent);
      };

      window.addEventListener(CONSOLE_EVENT_NAME, consoleEventHandler);

      // 注入脚本到页面主世界
      injectedConsoleScript = document.createElement('script');
      injectedConsoleScript.src = browser.runtime.getURL(
        '/console-interceptor.js' as '/popup.html'
      );
      injectedConsoleScript.onload = () => {
        logger.debug('Console interceptor injected');
      };
      injectedConsoleScript.onerror = (err) => {
        logger.error('Failed to inject console interceptor', err);
      };
      (document.head || document.documentElement).appendChild(injectedConsoleScript);
    }

    /**
     * 移除控制台拦截
     */
    function removeConsoleInterceptor() {
      if (consoleEventHandler) {
        window.removeEventListener(CONSOLE_EVENT_NAME, consoleEventHandler);
        consoleEventHandler = null;
      }
      if (injectedConsoleScript) {
        injectedConsoleScript.remove();
        injectedConsoleScript = null;
      }
    }
  },
});
