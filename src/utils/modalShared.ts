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

let isModalOpen = false;

function injectModalStyles(): void {
  if (document.getElementById('dpp-modal-styles')) return;

  const style = document.createElement('style');
  style.id = 'dpp-modal-styles';
  style.textContent = MODAL_STYLES;
  document.head.appendChild(style);
}

export function tryOpenModal(): boolean {
  if (isModalOpen) {
    return false;
  }

  isModalOpen = true;
  return true;
}

export function closeModal(overlay: HTMLElement): void {
  if (document.body.contains(overlay)) {
    document.body.removeChild(overlay);
  }
  isModalOpen = false;
}

export function createModalBase(title: string): {
  content: HTMLElement;
  overlay: HTMLElement;
} {
  injectModalStyles();

  const overlay = document.createElement('div');
  overlay.className = 'dpp-modal-overlay';

  const content = document.createElement('div');
  content.className = 'dpp-modal-content';

  const titleEl = document.createElement('div');
  titleEl.className = 'dpp-modal-title';
  titleEl.textContent = title;

  content.appendChild(titleEl);
  overlay.appendChild(content);

  return { content, overlay };
}

export function createMessageElement(message: string): HTMLElement {
  const messageEl = document.createElement('div');
  messageEl.className = 'dpp-modal-message';
  messageEl.textContent = message;
  return messageEl;
}

export function createButtonsContainer(): HTMLElement {
  const buttons = document.createElement('div');
  buttons.className = 'dpp-modal-buttons';
  return buttons;
}

export function createModalButton(className: string, text: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = className;
  button.textContent = text;
  return button;
}
