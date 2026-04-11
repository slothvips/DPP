import { logger } from './logger';
import {
  closeModal,
  createButtonsContainer,
  createMessageElement,
  createModalBase,
  createModalButton,
  tryOpenModal,
} from './modalShared';

/**
 * Custom modal dialog utilities to replace browser's alert/confirm/prompt
 * These work in content script context (injected into web pages)
 */

export function showAlert(message: string, title: string = '提示'): void {
  if (!tryOpenModal()) return;

  logger.debug('[DPP Modal]', 'showAlert:', message);

  const { content, overlay } = createModalBase(title);
  const messageEl = createMessageElement(message);
  const buttons = createButtonsContainer();
  const okBtn = createModalButton('dpp-modal-btn dpp-modal-btn-ok', '确定');

  okBtn.onclick = () => {
    closeModal(overlay);
  };

  buttons.appendChild(okBtn);
  content.appendChild(messageEl);
  content.appendChild(buttons);
  document.body.appendChild(overlay);
  okBtn.focus();
}

export function showConfirm(message: string, title: string = '确认'): Promise<boolean> {
  if (!tryOpenModal()) return Promise.resolve(false);

  logger.debug('[DPP Modal]', 'showConfirm:', message);

  return new Promise((resolve) => {
    const { content, overlay } = createModalBase(title);
    const messageEl = createMessageElement(message);
    const buttons = createButtonsContainer();
    const cancelBtn = createModalButton('dpp-modal-btn dpp-modal-btn-cancel', '取消');
    const confirmBtn = createModalButton('dpp-modal-btn dpp-modal-btn-confirm', '确定');

    cancelBtn.onclick = () => {
      closeModal(overlay);
      resolve(false);
    };

    confirmBtn.onclick = () => {
      closeModal(overlay);
      resolve(true);
    };

    buttons.appendChild(cancelBtn);
    buttons.appendChild(confirmBtn);
    content.appendChild(messageEl);
    content.appendChild(buttons);
    document.body.appendChild(overlay);
    cancelBtn.focus();
  });
}

export function showPrompt(
  message: string,
  defaultValue: string = '',
  title: string = '输入'
): Promise<string | null> {
  if (!tryOpenModal()) return Promise.resolve(null);

  logger.debug('[DPP Modal]', 'showPrompt:', message);

  return new Promise((resolve) => {
    const { content, overlay } = createModalBase(title);
    const messageEl = createMessageElement(message);
    const input = document.createElement('input');
    input.type = 'text';
    input.value = defaultValue;
    input.style.cssText =
      'width: 100%; padding: 8px; margin-bottom: 20px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;';

    const buttons = createButtonsContainer();
    const cancelBtn = createModalButton('dpp-modal-btn dpp-modal-btn-cancel', '取消');
    const confirmBtn = createModalButton('dpp-modal-btn dpp-modal-btn-confirm', '确定');

    cancelBtn.onclick = () => {
      closeModal(overlay);
      resolve(null);
    };

    confirmBtn.onclick = () => {
      closeModal(overlay);
      resolve(input.value);
    };

    input.onkeydown = (event) => {
      if (event.key === 'Enter') {
        confirmBtn.click();
      } else if (event.key === 'Escape') {
        cancelBtn.click();
      }
    };

    buttons.appendChild(cancelBtn);
    buttons.appendChild(confirmBtn);
    content.appendChild(messageEl);
    content.appendChild(input);
    content.appendChild(buttons);
    document.body.appendChild(overlay);
    input.focus();
    input.select();
  });
}
