import { logger } from '@/utils/logger';
import { saveJenkinsToken } from './shared';

export function showJenkinsNotification(message: string, isError = false) {
  const notification = document.createElement('div');
  notification.innerText = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 16px;
    background: ${isError ? '#ef4444' : '#22c55e'};
    color: white;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    z-index: 99999;
    font-family: system-ui, sans-serif;
    font-weight: 500;
  `;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 5000);
}

export function injectJenkinsSaveButton(target: HTMLElement, token: string) {
  const button = document.createElement('button');
  button.innerText = '💾 保存到 DPP';
  button.style.cssText = `
    margin-left: 10px;
    padding: 4px 8px;
    background: #2563eb;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
  `;

  button.onclick = async (event) => {
    event.preventDefault();
    try {
      await saveJenkinsToken(token);
      button.innerText = '✅ 已保存！';
      button.style.background = '#16a34a';
    } catch (error) {
      logger.debug(error);
      button.innerText = '❌ 错误';
    }
  };

  target.appendChild(button);
}

export function observeJenkinsTokenGeneration() {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.addedNodes.length === 0) continue;

      const tokenValueElements = document.querySelectorAll(
        '.new-token-value:not([data-dpp-processed])'
      );
      for (const element of tokenValueElements) {
        const token = (element as HTMLElement).innerText.trim();
        if (token) {
          injectJenkinsSaveButton(element as HTMLElement, token);
        }
        element.setAttribute('data-dpp-processed', 'true');
      }
    }
  });

  const tokenList = document.querySelector('.token-list') || document.body;
  observer.observe(tokenList, { childList: true, subtree: true });
}
