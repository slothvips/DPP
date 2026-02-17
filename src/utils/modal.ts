import { logger } from './logger';

/**
 * Custom modal dialog utilities to replace browser's alert/confirm/prompt
 * These work in content script context (injected into web pages)
 */

// Track if modal is currently open
let isModalOpen = false;

// Create modal container styles
const MODAL_STYLES = `
  .dpp-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  .dpp-modal-content {
    background: white;
    border-radius: 8px;
    padding: 20px;
    max-width: 400px;
    width: 90%;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  }
  .dpp-modal-title {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 12px;
    color: #333;
  }
  .dpp-modal-message {
    font-size: 14px;
    color: #666;
    margin-bottom: 20px;
    line-height: 1.5;
  }
  .dpp-modal-buttons {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
  }
  .dpp-modal-btn {
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 14px;
    cursor: pointer;
    border: none;
    transition: background 0.2s;
  }
  .dpp-modal-btn-cancel {
    background: #e0e0e0;
    color: #333;
  }
  .dpp-modal-btn-cancel:hover {
    background: #d0d0d0;
  }
  .dpp-modal-btn-confirm {
    background: #0066cc;
    color: white;
  }
  .dpp-modal-btn-confirm:hover {
    background: #0055aa;
  }
  .dpp-modal-btn-ok {
    background: #0066cc;
    color: white;
  }
  .dpp-modal-btn-ok:hover {
    background: #0055aa;
  }
  .dpp-modal-btn-danger {
    background: #dc3545;
    color: white;
  }
  .dpp-modal-btn-danger:hover {
    background: #c82333;
  }
`;

function injectStyles(): void {
  if (document.getElementById('dpp-modal-styles')) return;

  const style = document.createElement('style');
  style.id = 'dpp-modal-styles';
  style.textContent = MODAL_STYLES;
  document.head.appendChild(style);
}

function createModalBase(title: string): HTMLElement {
  injectStyles();

  const overlay = document.createElement('div');
  overlay.className = 'dpp-modal-overlay';

  const content = document.createElement('div');
  content.className = 'dpp-modal-content';

  const titleEl = document.createElement('div');
  titleEl.className = 'dpp-modal-title';
  titleEl.textContent = title;

  content.appendChild(titleEl);
  overlay.appendChild(content);

  return overlay;
}

/**
 * Show a custom alert dialog (replacement for window.alert)
 * Works in content script context
 */
export function showAlert(message: string, title: string = '提示'): void {
  if (isModalOpen) return;
  isModalOpen = true;

  logger.debug('[DPP Modal]', 'showAlert:', message);

  const overlay = createModalBase(title);

  const messageEl = document.createElement('div');
  messageEl.className = 'dpp-modal-message';
  messageEl.textContent = message;

  const buttons = document.createElement('div');
  buttons.className = 'dpp-modal-buttons';

  const okBtn = document.createElement('button');
  okBtn.className = 'dpp-modal-btn dpp-modal-btn-ok';
  okBtn.textContent = '确定';
  okBtn.onclick = () => {
    document.body.removeChild(overlay);
    isModalOpen = false;
  };

  buttons.appendChild(okBtn);
  overlay.querySelector('.dpp-modal-content')!.appendChild(messageEl);
  overlay.querySelector('.dpp-modal-content')!.appendChild(buttons);

  document.body.appendChild(overlay);

  okBtn.focus();
}

/**
 * Show a custom confirm dialog (replacement for window.confirm)
 * Returns a Promise that resolves to true/false
 */
export function showConfirm(message: string, title: string = '确认'): Promise<boolean> {
  if (isModalOpen) return Promise.resolve(false);
  isModalOpen = true;

  logger.debug('[DPP Modal]', 'showConfirm:', message);

  return new Promise((resolve) => {
    const overlay = createModalBase(title);

    const messageEl = document.createElement('div');
    messageEl.className = 'dpp-modal-message';
    messageEl.textContent = message;

    const buttons = document.createElement('div');
    buttons.className = 'dpp-modal-buttons';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'dpp-modal-btn dpp-modal-btn-cancel';
    cancelBtn.textContent = '取消';
    cancelBtn.onclick = () => {
      document.body.removeChild(overlay);
      isModalOpen = false;
      resolve(false);
    };

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'dpp-modal-btn dpp-modal-btn-confirm';
    confirmBtn.textContent = '确定';
    confirmBtn.onclick = () => {
      document.body.removeChild(overlay);
      isModalOpen = false;
      resolve(true);
    };

    buttons.appendChild(cancelBtn);
    buttons.appendChild(confirmBtn);

    overlay.querySelector('.dpp-modal-content')!.appendChild(messageEl);
    overlay.querySelector('.dpp-modal-content')!.appendChild(buttons);

    document.body.appendChild(overlay);

    cancelBtn.focus();
  });
}

/**
 * Show a custom prompt dialog (replacement for window.prompt)
 * Returns a Promise that resolves to the input value or null if cancelled
 */
export function showPrompt(
  message: string,
  defaultValue: string = '',
  title: string = '输入'
): Promise<string | null> {
  if (isModalOpen) return Promise.resolve(null);
  isModalOpen = true;

  logger.debug('[DPP Modal]', 'showPrompt:', message);

  return new Promise((resolve) => {
    const overlay = createModalBase(title);

    const messageEl = document.createElement('div');
    messageEl.className = 'dpp-modal-message';
    messageEl.textContent = message;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = defaultValue;
    input.style.cssText =
      'width: 100%; padding: 8px; margin-bottom: 20px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;';

    const buttons = document.createElement('div');
    buttons.className = 'dpp-modal-buttons';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'dpp-modal-btn dpp-modal-btn-cancel';
    cancelBtn.textContent = '取消';
    cancelBtn.onclick = () => {
      document.body.removeChild(overlay);
      isModalOpen = false;
      resolve(null);
    };

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'dpp-modal-btn dpp-modal-btn-confirm';
    confirmBtn.textContent = '确定';
    confirmBtn.onclick = () => {
      document.body.removeChild(overlay);
      isModalOpen = false;
      resolve(input.value);
    };

    buttons.appendChild(cancelBtn);
    buttons.appendChild(confirmBtn);

    const content = overlay.querySelector('.dpp-modal-content')!;
    content.appendChild(messageEl);
    content.appendChild(input);
    content.appendChild(buttons);

    document.body.appendChild(overlay);

    input.focus();
    input.select();

    // Handle Enter key
    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        confirmBtn.click();
      } else if (e.key === 'Escape') {
        cancelBtn.click();
      }
    };
  });
}
