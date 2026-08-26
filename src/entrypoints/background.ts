// Background script - Main entry point
// This file handles startup wiring and delegates lifecycle/message routing
import { browser } from 'wxt/browser';
import { BROWSER_TASK_HOST_PORT_NAME } from '@/lib/browserTask/types';
import { logger } from '@/utils/logger';
import { registerBackgroundLifecycle } from './background/backgroundLifecycle';
import { routeBackgroundMessage } from './background/backgroundMessageRouter';
import { stopAllBrowserTasks } from './background/handlers';

export default defineBackground(() => {
  logger.info('Background started');

  registerBackgroundLifecycle();

  const taskHostPorts = new Set<Browser.runtime.Port>();
  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== BROWSER_TASK_HOST_PORT_NAME) return;
    taskHostPorts.add(port);
    port.onDisconnect.addListener(() => {
      taskHostPorts.delete(port);
      if (taskHostPorts.size === 0) void stopAllBrowserTasks('system');
    });
  });

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const result = routeBackgroundMessage(message as { type: string; payload?: unknown }, sender);

    if (result === false) {
      return false;
    }

    if (result instanceof Promise) {
      result.then(sendResponse).catch((error) => {
        logger.error('Background message handler failed:', error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    } else {
      sendResponse(result);
    }

    return true;
  });
});
