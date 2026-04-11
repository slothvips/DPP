// Background script - Main entry point
// This file handles startup wiring and delegates lifecycle/message routing
import { browser } from 'wxt/browser';
import { logger } from '@/utils/logger';
import { registerBackgroundLifecycle } from './background/backgroundLifecycle';
import { routeBackgroundMessage } from './background/backgroundMessageRouter';

export default defineBackground(() => {
  logger.info('Background started');

  registerBackgroundLifecycle();

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
