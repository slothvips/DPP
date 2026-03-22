// Browser management AI tools
import { browser } from 'wxt/browser';
import { validateUrl } from '@/features/links/utils';
import { createToolParameter, toolRegistry } from '../tools';
import type { ToolHandler } from '../tools';

/**
 * Open a URL in a new tab
 */
async function browser_openUrl(args: { url: string }) {
  const validatedUrl = validateUrl(args.url);
  if (!validatedUrl) {
    return { success: false, error: 'Invalid or unsafe URL' };
  }

  await browser.tabs.create({ url: validatedUrl, active: true });
  return { success: true, message: `Opened ${validatedUrl} in new tab`, url: validatedUrl };
}

// Export tool function for testing
export { browser_openUrl };

/**
 * Register all browser tools
 */
export function registerBrowserTools() {
  toolRegistry.register({
    name: 'browser_openUrl',
    description: 'Open a URL in a new tab. Automatically adds https:// if no protocol specified.',
    parameters: createToolParameter(
      {
        url: {
          type: 'string',
          description:
            'The URL to open. Can be with or without protocol (e.g., "https://github.com" or "github.com")',
        },
      },
      ['url']
    ),
    handler: browser_openUrl as ToolHandler,
  });
}
