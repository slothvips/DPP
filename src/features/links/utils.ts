import { getLinkByUrl, recordLinkVisit } from '@/lib/db';
import { logger } from '@/utils/logger';

/**
 * Validate and normalize URL for security
 * Returns the validated URL or null if invalid/unsafe
 */
export function validateUrl(url: string): string | null {
  if (!url) {
    logger.warn('[Security] Empty URL provided');
    return null;
  }

  let finalUrl = url.trim();

  // Security: Strict protocol validation - block dangerous protocols
  const dangerousProtocols = ['javascript:', 'data:', 'file:', 'vbscript:', 'about:'];
  const lowerUrl = finalUrl.toLowerCase();

  if (dangerousProtocols.some((proto) => lowerUrl.startsWith(proto))) {
    logger.error('[Security] Blocked dangerous URL protocol:', finalUrl);
    return null;
  }

  // Check if URL already has a safe protocol
  const hasHttpProtocol = finalUrl.startsWith('http://') || finalUrl.startsWith('https://');

  if (!hasHttpProtocol) {
    // Auto-add https only for valid domain-like strings
    if (finalUrl.includes('.') && !finalUrl.includes(':')) {
      finalUrl = `https://${finalUrl}`;
    } else {
      logger.warn('[Security] Blocked invalid URL format:', finalUrl);
      return null;
    }
  }

  // Final validation: Ensure URL is properly formatted and uses safe protocol
  try {
    const urlObj = new URL(finalUrl);
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      logger.error('[Security] Invalid protocol after normalization:', urlObj.protocol);
      return null;
    }
    return finalUrl;
  } catch (e) {
    logger.error('[Security] Invalid URL format:', finalUrl, e);
    return null;
  }
}

export async function openLink(url: string) {
  const validatedUrl = validateUrl(url);
  if (!validatedUrl) return;

  // Record usage
  try {
    const link = await getLinkByUrl(validatedUrl);

    if (link) {
      await recordLinkVisit({ id: link.id });
    }
  } catch (err) {
    logger.error('Failed to record link usage:', err);
  }

  // Open link
  if (typeof browser !== 'undefined' && browser.tabs) {
    await browser.tabs.create({ url: validatedUrl });
  } else {
    window.open(validatedUrl, '_blank');
  }
}
