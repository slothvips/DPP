import { db } from '@/db';
import { logger } from '@/utils/logger';

export async function recordLinkVisit(id: string) {
  try {
    await db.transaction('rw', db.linkStats, async () => {
      const stat = await db.linkStats.get(id);
      const newStat = {
        id,
        usageCount: (stat?.usageCount || 0) + 1,
        lastUsedAt: Date.now(),
        pinnedAt: stat?.pinnedAt,
      };
      await db.linkStats.put(newStat);
    });
    logger.info(`Recorded visit for link ${id}`);
  } catch (error) {
    logger.error('Failed to record link visit:', error);
  }
}

export async function openLink(url: string) {
  if (!url) return;

  let finalUrl = url.trim();

  // Security: Strict protocol validation - block dangerous protocols
  const dangerousProtocols = ['javascript:', 'data:', 'file:', 'vbscript:', 'about:'];
  const lowerUrl = finalUrl.toLowerCase();

  if (dangerousProtocols.some((proto) => lowerUrl.startsWith(proto))) {
    logger.error('[Security] Blocked dangerous URL protocol:', finalUrl);
    return;
  }

  // Check if URL already has a safe protocol
  const hasHttpProtocol = finalUrl.startsWith('http://') || finalUrl.startsWith('https://');

  if (!hasHttpProtocol) {
    // Auto-add https only for valid domain-like strings
    if (finalUrl.includes('.') && !finalUrl.includes(':')) {
      finalUrl = `https://${finalUrl}`;
    } else {
      logger.warn('[Security] Blocked invalid URL format:', finalUrl);
      return;
    }
  }

  // Final validation: Ensure URL is properly formatted and uses safe protocol
  try {
    const urlObj = new URL(finalUrl);
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      logger.error('[Security] Invalid protocol after normalization:', urlObj.protocol);
      return;
    }
  } catch (e) {
    logger.error('[Security] Invalid URL format:', finalUrl, e);
    return;
  }

  // Record usage
  try {
    const link = await db.links.filter((l) => l.url === finalUrl && !l.deletedAt).first();

    if (link) {
      await recordLinkVisit(link.id);
    }
  } catch (err) {
    logger.error('Failed to record link usage:', err);
  }

  // Open link
  if (typeof browser !== 'undefined' && browser.tabs) {
    await browser.tabs.create({ url: finalUrl });
  } else {
    window.open(finalUrl, '_blank');
  }
}

export async function generateStableLinkId(url: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(url);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
