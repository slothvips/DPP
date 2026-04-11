import { showAlert } from '@/utils/modal';
import { RRWEB_JSON_SUFFIX, applyStyles, logZentao } from './shared';

export function enhanceIframeAttachments(): number {
  let enhanced = 0;
  const attachmentLinks = document.querySelectorAll<HTMLAnchorElement>(
    `a[href*="${RRWEB_JSON_SUFFIX}"]`
  );

  for (const link of attachmentLinks) {
    if (link.dataset.rrwebEnhanced) {
      continue;
    }

    const url = new URL(link.href, window.location.href);
    if (!url.pathname.endsWith(RRWEB_JSON_SUFFIX)) {
      continue;
    }

    const playButton = document.createElement('button');
    playButton.textContent = '▶️ Play';
    playButton.type = 'button';
    applyStyles(playButton, {
      marginLeft: '8px',
      padding: '2px 8px',
      fontSize: '12px',
      background: '#4caf50',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
    });

    playButton.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const playerUrl = browser.runtime.getURL(`/player.html?url=${encodeURIComponent(link.href)}`);
      window.open(playerUrl, '_blank');
    };

    link.after(playButton);
    link.dataset.rrwebEnhanced = 'true';
    enhanced++;
  }

  return enhanced;
}

export function enhanceMainFrameAttachments(doc: Document) {
  const allLinks = doc.querySelectorAll<HTMLAnchorElement>('a');
  let foundRrweb = false;

  for (const link of allLinks) {
    if (link.dataset.dppEnhanced) {
      continue;
    }

    const href = link.href || '';
    const text = link.textContent?.trim() || '';
    const title = link.getAttribute('title') || '';
    const isRrwebFile =
      href.includes(RRWEB_JSON_SUFFIX) ||
      text.includes(RRWEB_JSON_SUFFIX) ||
      title.includes(RRWEB_JSON_SUFFIX);

    if (!isRrwebFile) {
      continue;
    }

    foundRrweb = true;
    logZentao('Found rrweb attachment:', { href, text, title });
    link.dataset.dppEnhanced = 'true';

    const playButton = doc.createElement('button');
    playButton.type = 'button';
    playButton.innerHTML = '▶️ 播放录像';
    applyStyles(playButton, {
      marginLeft: '8px',
      padding: '4px 12px',
      fontSize: '12px',
      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      color: 'white',
      border: 'none',
      borderRadius: '5px',
      cursor: 'pointer',
      fontWeight: '500',
      boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)',
      transition: 'all 0.2s',
      verticalAlign: 'middle',
    });

    playButton.onmouseenter = () => {
      playButton.style.transform = 'translateY(-1px)';
      playButton.style.boxShadow = '0 4px 8px rgba(16, 185, 129, 0.4)';
    };
    playButton.onmouseleave = () => {
      playButton.style.transform = '';
      playButton.style.boxShadow = '0 2px 4px rgba(16, 185, 129, 0.3)';
    };

    playButton.onclick = async (event) => {
      event.preventDefault();
      event.stopPropagation();

      const jsonUrl = href.includes(RRWEB_JSON_SUFFIX)
        ? href
        : link.closest('[data-url]')?.getAttribute('data-url') || href;

      logZentao('Fetching recording from:', jsonUrl);

      const originalText = playButton.innerHTML;
      playButton.innerHTML = '⏳ 加载中...';
      playButton.disabled = true;

      try {
        const response = await browser.runtime.sendMessage({
          type: 'ZEN_FETCH_JSON',
          payload: { url: jsonUrl },
        });

        if (!response.success) {
          throw new Error(response.error || '下载失败');
        }

        const events = response.data as unknown[];
        logZentao('Fetched events count:', events.length);

        const cacheId = `remote_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const fileName = text || title || 'Remote Recording';

        await browser.runtime.sendMessage({
          type: 'REMOTE_RECORDING_CACHE',
          payload: { cacheId, events, title: fileName },
        });

        await browser.runtime.sendMessage({
          type: 'OPEN_PLAYER_TAB',
          payload: { cacheId },
        });

        playButton.innerHTML = originalText;
        playButton.disabled = false;
      } catch (error) {
        logZentao('Error fetching recording:', error);
        playButton.innerHTML = '❌ 失败';
        setTimeout(() => {
          playButton.innerHTML = originalText;
          playButton.disabled = false;
        }, 2000);
        showAlert(`加载录像失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    };

    link.after(playButton);
  }

  if (!foundRrweb && allLinks.length > 0) {
    logZentao(`Scanned ${allLinks.length} links, no .rrweb.json found`);
  }
}
