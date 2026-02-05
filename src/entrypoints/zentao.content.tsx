import { createRoot } from 'react-dom/client';
import { ZentaoUploader } from '@/features/recorder/components/ZentaoUploader';

const DEBUG = true;

function log(...args: unknown[]) {
  if (DEBUG) console.log('[DPP Zentao]', ...args);
}

export default defineContentScript({
  matches: ['*://*/*zentao*'],
  allFrames: true,
  runAt: 'document_idle',
  main() {
    const currentUrl = window.location.href;
    const isInIframe = window !== window.top;

    log('Init:', currentUrl, 'iframe:', isInIframe);

    if (isInIframe) {
      runInIframe();
    } else {
      runInMainFrame();
    }
  },
});

function runInIframe() {
  log('Running in iframe context');
  let injectionCount = 0;

  function injectRecorderUploader(): number {
    let injected = 0;

    const selectorBoxes = document.querySelectorAll<HTMLElement>(
      '.file-selector-box:not([data-dpp-injected])'
    );

    for (const box of selectorBoxes) {
      box.setAttribute('data-dpp-injected', 'true');
      const inputId = box.getAttribute('for');
      const input = inputId ? document.getElementById(inputId) : null;

      if (input instanceof HTMLInputElement && input.type === 'file') {
        log('Strategy 1: .file-selector-box', inputId);
        input.dataset.dppUploaderInjected = 'true';

        const container = document.createElement('span');
        container.className = 'dpp-uploader-container';
        Object.assign(container.style, {
          display: 'inline-block',
          verticalAlign: 'middle',
          marginLeft: '8px',
        });

        box.after(container);
        createRoot(container).render(<ZentaoUploader targetInput={input} />);
        injected++;
      }
    }

    const zentaoGroups = document.querySelectorAll<HTMLElement>(
      '.form-group[data-name="files"]:not([data-dpp-injected])'
    );

    for (const group of zentaoGroups) {
      group.setAttribute('data-dpp-injected', 'true');

      const label = group.querySelector('.form-label, label');
      const input = group.querySelector<HTMLInputElement>('input[type="file"]');

      if (label && input) {
        log('Strategy 2: .form-group[data-name="files"]');
        input.dataset.dppUploaderInjected = 'true';

        const container = document.createElement('span');
        container.className = 'dpp-uploader-container';
        Object.assign(container.style, {
          display: 'inline-block',
          verticalAlign: 'middle',
          marginLeft: '8px',
          fontWeight: 'normal',
        });

        label.appendChild(container);
        createRoot(container).render(<ZentaoUploader targetInput={input} />);
        injected++;
      }
    }

    const fileContainers = document.querySelectorAll<HTMLElement>(
      '.file-list:not([data-dpp-injected]), .uploader:not([data-dpp-injected]), .fileBox:not([data-dpp-injected]), [class*="file-upload"]:not([data-dpp-injected])'
    );

    for (const container of fileContainers) {
      const input = container.querySelector<HTMLInputElement>(
        'input[type="file"]:not([data-dpp-uploader-injected])'
      );
      if (!input) continue;

      container.setAttribute('data-dpp-injected', 'true');
      input.dataset.dppUploaderInjected = 'true';

      log('Strategy 3: file container', container.className);

      const uploaderContainer = document.createElement('span');
      uploaderContainer.className = 'dpp-uploader-container';
      Object.assign(uploaderContainer.style, {
        display: 'inline-flex',
        verticalAlign: 'middle',
        marginLeft: '8px',
      });

      const insertTarget =
        container.querySelector('.btn, button, .file-selector-box, label[for]') || container;
      insertTarget.after(uploaderContainer);

      createRoot(uploaderContainer).render(<ZentaoUploader targetInput={input} />);
      injected++;
    }

    const fileInputs = document.querySelectorAll<HTMLInputElement>(
      'input[type="file"]:not([data-dpp-uploader-injected])'
    );

    for (const input of fileInputs) {
      if (input.offsetParent === null && !input.closest('.form-group, .file-list, .uploader')) {
        continue;
      }

      input.dataset.dppUploaderInjected = 'true';
      log('Strategy 4: generic file input', input.name || input.id);

      const container = document.createElement('span');
      container.className = 'dpp-uploader-container';
      Object.assign(container.style, {
        display: 'inline-flex',
        verticalAlign: 'middle',
        marginLeft: '8px',
      });

      const parent =
        input.closest('.form-group, .form-control, .input-group, .file-list') ||
        input.parentElement;

      if (parent) {
        parent.appendChild(container);
        createRoot(container).render(<ZentaoUploader targetInput={input} />);
        injected++;
      }
    }

    return injected;
  }

  function enhanceZentaoAttachments(): number {
    let enhanced = 0;
    const attachmentLinks = document.querySelectorAll<HTMLAnchorElement>('a[href*=".rrweb.json"]');

    for (const link of attachmentLinks) {
      if (link.dataset.rrwebEnhanced) continue;

      const url = new URL(link.href, window.location.href);
      if (!url.pathname.endsWith('.rrweb.json')) continue;

      const playButton = document.createElement('button');
      playButton.textContent = '▶️ Play';
      playButton.type = 'button';

      Object.assign(playButton.style, {
        marginLeft: '8px',
        padding: '2px 8px',
        fontSize: '12px',
        background: '#4caf50',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
      });

      playButton.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const jsonUrl = link.href;
        const playerUrl = browser.runtime.getURL(`/player.html?url=${encodeURIComponent(jsonUrl)}`);
        window.open(playerUrl, '_blank');
      };

      link.after(playButton);
      link.dataset.rrwebEnhanced = 'true';
      enhanced++;
    }

    return enhanced;
  }

  function runInjection() {
    const attachments = enhanceZentaoAttachments();
    const uploaders = injectRecorderUploader();

    if (attachments > 0 || uploaders > 0) {
      injectionCount += uploaders;
      log(`Injected: ${uploaders} uploaders, ${attachments} attachments. Total: ${injectionCount}`);
    }
  }

  if (document.body) {
    log('Body ready, starting injection');
    runInjection();

    const retryIntervals = [500, 1000, 2000, 3000, 5000, 8000];
    for (const delay of retryIntervals) {
      setTimeout(runInjection, delay);
    }

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const observer = new MutationObserver(() => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(runInjection, 100);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
}

function runInMainFrame() {
  log('Running in main frame - will monitor iframes');

  function processIframe(iframe: HTMLIFrameElement) {
    try {
      const iframeDoc = iframe.contentDocument;
      const iframeWin = iframe.contentWindow;

      if (!iframeDoc || !iframeWin) {
        log('Cannot access iframe content (cross-origin or not ready)');
        return;
      }

      log('Processing iframe:', iframe.src || iframe.id);

      injectIntoDocument(iframeDoc, iframeWin);
    } catch (e) {
      log('Error accessing iframe:', e);
    }
  }

  function injectIntoDocument(doc: Document, win: Window) {
    let injected = false;

    function injectButton(formGroup: HTMLElement, input: HTMLInputElement) {
      if (formGroup.dataset.dppInjected) return;
      formGroup.dataset.dppInjected = 'true';

      log('Injecting button into form group');

      const button = doc.createElement('button');
      button.type = 'button';
      button.className = 'dpp-upload-btn';
      button.innerHTML = '📹 上传录像';
      Object.assign(button.style, {
        padding: '6px 14px',
        fontSize: '13px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontWeight: '500',
        boxShadow: '0 2px 4px rgba(102, 126, 234, 0.3)',
        transition: 'all 0.2s ease',
        marginTop: '8px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
      });

      button.onmouseenter = () => {
        button.style.transform = 'translateY(-1px)';
        button.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
      };
      button.onmouseleave = () => {
        button.style.transform = '';
        button.style.boxShadow = '0 2px 4px rgba(102, 126, 234, 0.3)';
      };

      button.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const originalText = button.innerHTML;
        button.innerHTML = '⏳ 加载中...';
        button.disabled = true;

        try {
          const res = await browser.runtime.sendMessage({ type: 'RECORDER_GET_ALL_RECORDINGS' });
          if (res.success && res.recordings?.length > 0) {
            showRecordingPicker(doc, res.recordings, input, button, originalText, win);
          } else {
            win.alert('暂无录像记录');
            button.innerHTML = originalText;
            button.disabled = false;
          }
        } catch (err) {
          log('Error loading recordings:', err);
          win.alert('加载录像失败');
          button.innerHTML = originalText;
          button.disabled = false;
        }
      };

      const uploaderArea = formGroup.querySelector('.uploader, .file-list, .form-control');
      if (uploaderArea) {
        uploaderArea.after(button);
      } else {
        formGroup.appendChild(button);
      }

      injected = true;
    }

    function runInjection() {
      if (injected) return;

      const formGroup = doc.querySelector<HTMLElement>('.form-group[data-name="files"]');
      if (formGroup && !formGroup.dataset.dppInjected) {
        const input = formGroup.querySelector<HTMLInputElement>('input[type="file"]');
        if (input) {
          injectButton(formGroup, input);
          return;
        }
      }

      const uploaders = doc.querySelectorAll<HTMLElement>(
        '.uploader:not([data-dpp-injected]), .file-list:not([data-dpp-injected])'
      );
      for (const uploader of uploaders) {
        const input = uploader.querySelector<HTMLInputElement>('input[type="file"]');
        if (input) {
          const parent = uploader.closest<HTMLElement>('.form-group') || uploader;
          injectButton(parent, input);
          return;
        }
      }

      const fileInputs = doc.querySelectorAll<HTMLInputElement>(
        'input[type="file"]:not([data-dpp-processed])'
      );
      for (const input of fileInputs) {
        input.dataset.dppProcessed = 'true';
        const parent = input.closest<HTMLElement>('.form-group') || input.parentElement;
        if (parent) {
          injectButton(parent as HTMLElement, input);
          return;
        }
      }
    }

    if (doc.body) {
      runInjection();
      enhanceAttachments();

      const retryIntervals = [500, 1000, 2000, 3000, 5000];
      for (const delay of retryIntervals) {
        setTimeout(() => {
          runInjection();
          enhanceAttachments();
        }, delay);
      }

      let debounceTimer: ReturnType<typeof setTimeout> | null = null;
      const observer = new MutationObserver(() => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          runInjection();
          enhanceAttachments();
        }, 100);
      });
      observer.observe(doc.body, { childList: true, subtree: true });
    }

    function enhanceAttachments() {
      const allLinks = doc.querySelectorAll('a');
      let foundRrweb = false;

      for (const link of allLinks) {
        if (link.dataset.dppEnhanced) continue;

        const href = link.href || '';
        const text = link.textContent?.trim() || '';
        const title = link.getAttribute('title') || '';

        const isRrwebFile =
          href.includes('.rrweb.json') ||
          text.includes('.rrweb.json') ||
          title.includes('.rrweb.json');

        if (isRrwebFile) {
          foundRrweb = true;
          log('Found rrweb attachment:', { href, text, title });

          link.dataset.dppEnhanced = 'true';

          const playBtn = doc.createElement('button');
          playBtn.type = 'button';
          playBtn.innerHTML = '▶️ 播放录像';
          Object.assign(playBtn.style, {
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

          playBtn.onmouseenter = () => {
            playBtn.style.transform = 'translateY(-1px)';
            playBtn.style.boxShadow = '0 4px 8px rgba(16, 185, 129, 0.4)';
          };
          playBtn.onmouseleave = () => {
            playBtn.style.transform = '';
            playBtn.style.boxShadow = '0 2px 4px rgba(16, 185, 129, 0.3)';
          };

          playBtn.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();

            let jsonUrl = href;
            if (!jsonUrl.includes('.rrweb.json')) {
              const downloadLink = link.closest('[data-url]')?.getAttribute('data-url') || href;
              jsonUrl = downloadLink;
            }

            log('Fetching recording from:', jsonUrl);

            const originalText = playBtn.innerHTML;
            playBtn.innerHTML = '⏳ 加载中...';
            playBtn.disabled = true;

            try {
              const response = await fetch(jsonUrl, { credentials: 'include' });
              if (!response.ok) {
                throw new Error(`下载失败: ${response.status}`);
              }

              const events = await response.json();
              log('Fetched events count:', events.length);

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

              playBtn.innerHTML = originalText;
              playBtn.disabled = false;
            } catch (err) {
              log('Error fetching recording:', err);
              playBtn.innerHTML = '❌ 失败';
              setTimeout(() => {
                playBtn.innerHTML = originalText;
                playBtn.disabled = false;
              }, 2000);
              win.alert(`加载录像失败: ${err instanceof Error ? err.message : String(err)}`);
            }
          };

          link.after(playBtn);
        }
      }

      if (!foundRrweb) {
        const linksCount = allLinks.length;
        if (linksCount > 0) {
          log(`Scanned ${linksCount} links, no .rrweb.json found`);
        }
      }
    }
  }

  function showRecordingPicker(
    doc: Document,
    recordings: Array<{
      id: string;
      title: string;
      createdAt: number;
      duration: number;
    }>,
    input: HTMLInputElement,
    button: HTMLButtonElement,
    originalText: string,
    win: Window
  ) {
    const existing = doc.getElementById('dpp-recording-picker');
    if (existing) existing.remove();

    const overlay = doc.createElement('div');
    overlay.id = 'dpp-recording-picker';
    Object.assign(overlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      right: '0',
      bottom: '0',
      background: 'rgba(0,0,0,0.5)',
      zIndex: '99999',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    });

    const modal = doc.createElement('div');
    Object.assign(modal.style, {
      background: 'white',
      borderRadius: '12px',
      padding: '20px',
      maxWidth: '500px',
      maxHeight: '70vh',
      overflow: 'auto',
      boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    });

    const title = doc.createElement('h3');
    title.textContent = '选择录像';
    Object.assign(title.style, {
      margin: '0 0 16px 0',
      fontSize: '18px',
      fontWeight: '600',
    });
    modal.appendChild(title);

    for (const rec of recordings) {
      const item = doc.createElement('div');
      Object.assign(item.style, {
        padding: '12px',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        marginBottom: '8px',
        cursor: 'pointer',
        transition: 'background 0.2s',
      });

      item.onmouseenter = () => {
        item.style.background = '#f3f4f6';
      };
      item.onmouseleave = () => {
        item.style.background = '';
      };

      const recTitle = doc.createElement('div');
      recTitle.textContent = rec.title;
      Object.assign(recTitle.style, { fontWeight: '500', marginBottom: '4px' });

      const recMeta = doc.createElement('div');
      recMeta.textContent = `${new Date(rec.createdAt).toLocaleString()} · ${Math.round(rec.duration / 1000)}秒`;
      Object.assign(recMeta.style, { fontSize: '12px', color: '#6b7280' });

      item.appendChild(recTitle);
      item.appendChild(recMeta);

      item.onclick = async () => {
        recTitle.textContent = '⏳ 加载中...';
        item.style.pointerEvents = 'none';
        item.style.opacity = '0.6';

        try {
          const res = await browser.runtime.sendMessage({
            type: 'RECORDER_GET_RECORDING_BY_ID',
            id: rec.id,
          });

          if (!res.success || !res.recording) {
            win.alert('加载录像失败');
            recTitle.textContent = rec.title;
            item.style.pointerEvents = '';
            item.style.opacity = '';
            return;
          }

          const recording = res.recording as { title: string; events: unknown[] };
          const safeTitle = recording.title.replace(/[^a-z0-9\u4e00-\u9fa5]/gi, '_');
          const filename = `${safeTitle}.rrweb.json`;
          const blob = new Blob([JSON.stringify(recording.events)], { type: 'application/json' });
          const file = new File([blob], filename, { type: 'application/json' });

          const dt = new DataTransfer();
          dt.items.add(file);
          input.files = dt.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));

          overlay.remove();
          button.innerHTML = '✅ 已选择';
          setTimeout(() => {
            button.innerHTML = originalText;
            button.disabled = false;
          }, 2000);
        } catch (err) {
          log('Error fetching recording:', err);
          win.alert('加载录像失败');
          recTitle.textContent = rec.title;
          item.style.pointerEvents = '';
          item.style.opacity = '';
        }
      };

      modal.appendChild(item);
    }

    const closeBtn = doc.createElement('button');
    closeBtn.textContent = '取消';
    Object.assign(closeBtn.style, {
      marginTop: '12px',
      padding: '8px 16px',
      background: '#e5e7eb',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      width: '100%',
    });
    closeBtn.onclick = () => {
      overlay.remove();
      button.innerHTML = originalText;
      button.disabled = false;
    };
    modal.appendChild(closeBtn);

    overlay.appendChild(modal);
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        overlay.remove();
        button.innerHTML = originalText;
        button.disabled = false;
      }
    };

    doc.body.appendChild(overlay);
  }

  function checkIframes() {
    const iframes = document.querySelectorAll<HTMLIFrameElement>(
      '#apps iframe, .app-container iframe'
    );
    log(`Found ${iframes.length} app iframes`);

    for (const iframe of iframes) {
      if (iframe.dataset.dppProcessed) continue;

      const tryProcess = () => {
        try {
          if (iframe.contentDocument?.readyState === 'complete') {
            iframe.dataset.dppProcessed = 'true';
            processIframe(iframe);
          } else {
            setTimeout(tryProcess, 500);
          }
        } catch {
          log('Iframe not ready yet, retrying...');
          setTimeout(tryProcess, 500);
        }
      };

      iframe.addEventListener('load', () => {
        log('Iframe load event fired');
        setTimeout(() => {
          iframe.dataset.dppProcessed = 'true';
          processIframe(iframe);
        }, 100);
      });

      tryProcess();
    }
  }

  if (document.body) {
    setTimeout(checkIframes, 500);
    setTimeout(checkIframes, 1500);
    setTimeout(checkIframes, 3000);
    setTimeout(checkIframes, 5000);

    const observer = new MutationObserver(() => {
      setTimeout(checkIframes, 200);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
}
