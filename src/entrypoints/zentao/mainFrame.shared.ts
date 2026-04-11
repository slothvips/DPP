import { showAlert } from '@/utils/modal';
import { showRecordingPicker } from './recordingPicker';
import { applyStyles, logZentao } from './shared';

interface RecordingSummary {
  id: string;
  title: string;
  createdAt: number;
  duration: number;
}

export function createUploadButton(doc: Document): HTMLButtonElement {
  const button = doc.createElement('button');
  button.type = 'button';
  button.className = 'dpp-upload-btn';
  button.innerHTML = '📹 上传录像';
  applyStyles(button, {
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

  return button;
}

export function bindUploadButton(
  button: HTMLButtonElement,
  doc: Document,
  input: HTMLInputElement
) {
  button.onclick = async (event) => {
    event.preventDefault();
    event.stopPropagation();

    const originalText = button.innerHTML;
    button.innerHTML = '⏳ 加载中...';
    button.disabled = true;

    try {
      const response = (await browser.runtime.sendMessage({
        type: 'RECORDER_GET_ALL_RECORDINGS',
      })) as {
        success: boolean;
        data?: RecordingSummary[];
        error?: string;
      };
      const recordings = response.data;

      if (!response.success) {
        showAlert(response.error || '加载录像失败');
        button.innerHTML = originalText;
        button.disabled = false;
        return;
      }

      if (recordings && recordings.length > 0) {
        showRecordingPicker(doc, recordings, input, button, originalText);
      } else {
        showAlert('暂无录像记录');
        button.innerHTML = originalText;
        button.disabled = false;
      }
    } catch (error) {
      logZentao('Error loading recordings:', error);
      showAlert('加载录像失败');
      button.innerHTML = originalText;
      button.disabled = false;
    }
  };
}
