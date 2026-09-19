import { showAlert } from '@/utils/modal';
import { applyStyles, logZentao } from './shared';

interface RecordingSummary {
  id: string;
  title: string;
  createdAt: number;
  duration: number;
}

export function showRecordingPicker(
  doc: Document,
  recordings: RecordingSummary[],
  input: HTMLInputElement,
  button: HTMLButtonElement,
  originalText: string
) {
  const existing = doc.getElementById('dpp-recording-picker');
  if (existing) {
    existing.remove();
  }

  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const palette = {
    modalBg: isDark ? '#1f2937' : 'white',
    titleColor: isDark ? '#f9fafb' : '',
    itemBorder: isDark ? '#374151' : '#e5e7eb',
    itemHover: isDark ? '#374151' : '#f3f4f6',
    metaColor: isDark ? '#9ca3af' : '#6b7280',
    closeBg: isDark ? '#374151' : '#e5e7eb',
    closeColor: isDark ? '#f3f4f6' : '',
  };

  const overlay = doc.createElement('div');
  overlay.id = 'dpp-recording-picker';
  applyStyles(overlay, {
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
  applyStyles(modal, {
    background: palette.modalBg,
    borderRadius: '12px',
    padding: '20px',
    maxWidth: '500px',
    maxHeight: '70vh',
    overflow: 'auto',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  });

  const title = doc.createElement('h3');
  title.textContent = '选择录像';
  applyStyles(title, {
    margin: '0 0 16px 0',
    fontSize: '18px',
    fontWeight: '600',
    color: palette.titleColor,
  });
  modal.appendChild(title);

  for (const recording of recordings) {
    const item = doc.createElement('div');
    applyStyles(item, {
      padding: '12px',
      border: `1px solid ${palette.itemBorder}`,
      borderRadius: '8px',
      marginBottom: '8px',
      cursor: 'pointer',
      transition: 'background 0.2s',
    });
    if (isDark) {
      item.style.color = '#f3f4f6';
    }

    item.onmouseenter = () => {
      item.style.background = palette.itemHover;
    };
    item.onmouseleave = () => {
      item.style.background = '';
    };

    const recordingTitle = doc.createElement('div');
    recordingTitle.textContent = recording.title;
    applyStyles(recordingTitle, { fontWeight: '500', marginBottom: '4px' });

    const recordingMeta = doc.createElement('div');
    recordingMeta.textContent = `${new Date(recording.createdAt).toLocaleString()} · ${Math.round(recording.duration / 1000)}秒`;
    applyStyles(recordingMeta, { fontSize: '12px', color: palette.metaColor });

    item.appendChild(recordingTitle);
    item.appendChild(recordingMeta);

    item.onclick = async () => {
      recordingTitle.textContent = '⏳ 加载中...';
      item.style.pointerEvents = 'none';
      item.style.opacity = '0.6';

      try {
        const response = await browser.runtime.sendMessage({
          type: 'RECORDER_GET_RECORDING_BY_ID',
          id: recording.id,
        });

        if (!response.success || !response.data) {
          showAlert('加载录像失败');
          recordingTitle.textContent = recording.title;
          item.style.pointerEvents = '';
          item.style.opacity = '';
          return;
        }

        const loadedRecording = response.data as { title: string; events: unknown[] };
        const filename = `${loadedRecording.title.replace(/[^a-z0-9\u4e00-\u9fa5]/gi, '_')}.rrweb.json`;
        const blob = new Blob([JSON.stringify(loadedRecording.events)], {
          type: 'application/json',
        });
        const file = new File([blob], filename, { type: 'application/json' });

        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        input.files = dataTransfer.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));

        overlay.remove();
        button.textContent = '✅ 已选择';
        setTimeout(() => {
          button.textContent = originalText;
          button.disabled = false;
        }, 2000);
      } catch (error) {
        logZentao('Error fetching recording:', error);
        showAlert('加载录像失败');
        recordingTitle.textContent = recording.title;
        item.style.pointerEvents = '';
        item.style.opacity = '';
      }
    };

    modal.appendChild(item);
  }

  const closeButton = doc.createElement('button');
  closeButton.textContent = '取消';
  applyStyles(closeButton, {
    marginTop: '12px',
    padding: '8px 16px',
    background: palette.closeBg,
    color: palette.closeColor,
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    width: '100%',
  });
  closeButton.onclick = () => {
    overlay.remove();
    button.textContent = originalText;
    button.disabled = false;
  };
  modal.appendChild(closeButton);

  overlay.appendChild(modal);
  overlay.onclick = (event) => {
    if (event.target === overlay) {
      overlay.remove();
      button.textContent = originalText;
      button.disabled = false;
    }
  };

  doc.body.appendChild(overlay);
}
