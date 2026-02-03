import { http } from '@/lib/http';
import { logger } from '@/utils/logger';

export default defineContentScript({
  matches: ['*://*/*'],
  runAt: 'document_idle',
  main() {
    // Headless Auth Mode: Triggered from Options page
    if (location.hash === '#dpp-auth') {
      runHeadlessAuth();
      return;
    }

    // Passive Mode: Only inject buttons on configure pages
    if (location.href.includes('/configure')) {
      observeTokenGeneration();
    }
  },
});

async function runHeadlessAuth() {
  try {
    showNotification('🔄 DPP: 正在连接 Jenkins...', false);

    // 1. Get Current User Info
    const userRes = await http(`${location.origin}/me/api/json?tree=id`, {
      timeout: 15000,
    });
    if (userRes.status === 403 || userRes.status === 401) {
      throw new Error('请先登录 Jenkins。');
    }
    if (!userRes.ok) throw new Error('无法识别 Jenkins 用户。');

    const userData = (await userRes.json()) as { id?: string };
    const userId = userData.id;
    if (!userId) throw new Error('无法获取用户 ID。');

    // 2. Generate Token
    const token = await generateJenkinsToken(userId, 'DPP Extension Auto');

    // 3. Save
    await saveToken(token, userId);

    // 4. Success & Close
    showNotification('✅ Token 已生成并保存！正在关闭...', false);
    setTimeout(() => {
      window.close();
    }, 1500);
  } catch (err) {
    logger.error('DPP Auth Failed:', err);
    showNotification(`❌ 错误: ${err instanceof Error ? err.message : String(err)}`, true);
  }
}

async function generateJenkinsToken(userId: string, tokenName: string): Promise<string> {
  // 1. Get CSRF Token (Crumb)
  const crumb = await getCrumb();
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
  };
  if (crumb) headers[crumb.header] = crumb.value;

  // 2. Call API
  // We use the specific user endpoint which is more reliable than /me/
  const endpoint = `${location.origin}/user/${userId}/descriptorByName/jenkins.security.ApiTokenProperty/generateNewToken`;

  const params = new URLSearchParams();
  params.append('newTokenName', tokenName);

  const response = await http(endpoint, {
    method: 'POST',
    headers,
    body: params,
    timeout: 15000,
  });

  if (!response.ok) {
    throw new Error(`Token 生成失败 (${response.status})`);
  }

  const result = (await response.json()) as {
    status?: string;
    data?: { tokenValue?: string };
  };
  if (result.status !== 'ok' || !result.data?.tokenValue) {
    throw new Error('Jenkins 返回了无效的 Token 响应');
  }

  return result.data.tokenValue;
}

async function saveToken(token: string, userId?: string) {
  await browser.runtime.sendMessage({
    type: 'SAVE_JENKINS_TOKEN',
    payload: {
      token,
      host: location.origin,
      user: userId || location.pathname.split('/user/')[1]?.split('/')[0] || 'unknown',
    },
  });
}

async function getCrumb(): Promise<{ header: string; value: string } | null> {
  // Priority 1: DOM (Modern Jenkins)
  const headCrumbValue =
    document.head.dataset.crumbValue || document.head.getAttribute('data-crumb-value');
  const headCrumbHeader =
    document.head.dataset.crumbHeader ||
    document.head.getAttribute('data-crumb-header') ||
    'Jenkins-Crumb';

  if (headCrumbValue) {
    return { header: headCrumbHeader, value: headCrumbValue };
  }

  // Priority 2: API
  try {
    const jenkinsRoot = document.head.getAttribute('data-rooturl') || '';
    const res = await http(`${jenkinsRoot}/crumbIssuer/api/json`, {
      timeout: 10000,
    });
    if (res.ok) {
      const data = (await res.json()) as { crumbRequestField?: string; crumb?: string };
      return { header: data.crumbRequestField || '', value: data.crumb || '' };
    }
  } catch (e) {
    logger.warn('Failed to fetch crumb via API', e);
  }

  return null;
}

function observeTokenGeneration() {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.addedNodes.length) {
        const tokenValueElements = document.querySelectorAll(
          '.new-token-value:not([data-dpp-processed])'
        );
        for (const el of tokenValueElements) {
          const token = (el as HTMLElement).innerText.trim();
          if (token) {
            injectSaveButton(el as HTMLElement, token);
          }
          el.setAttribute('data-dpp-processed', 'true');
        }
      }
    }
  });

  const tokenList = document.querySelector('.token-list') || document.body;
  observer.observe(tokenList, { childList: true, subtree: true });
}

function injectSaveButton(target: HTMLElement, token: string) {
  const btn = document.createElement('button');
  btn.innerText = '💾 保存到 DPP';
  btn.style.cssText = `
    margin-left: 10px;
    padding: 4px 8px;
    background: #2563eb;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
  `;

  btn.onclick = async (e) => {
    e.preventDefault();
    try {
      await saveToken(token);
      btn.innerText = '✅ 已保存！';
      btn.style.background = '#16a34a';
    } catch (err) {
      logger.error(err);
      btn.innerText = '❌ 错误';
    }
  };

  target.appendChild(btn);
}

function showNotification(msg: string, isError = false) {
  const div = document.createElement('div');
  div.innerText = msg;
  div.style.cssText = `
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
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 5000);
}
