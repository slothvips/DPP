import type { StoredEncryptedValue } from '@/db/types';
import { decryptData, encryptData, loadKey } from '@/lib/crypto/encryption';
import { getSetting, updateSetting } from '@/lib/db/settings';
import { logger } from '@/utils/logger';
import { isSensitiveFieldName } from '@/utils/sensitive';

export const DEFAULT_JENKINS_TG_RELEASE_KEYWORDS =
  'release,publish,deploy,prod,production,发布,生产';

export interface JenkinsTelegramConfig {
  enabled: boolean;
  botToken: string;
  chatId: string;
  releaseKeywords: string;
}

export interface JenkinsTelegramBuildContext {
  jobName: string;
  jobUrl: string;
  envId?: string;
  jenkinsUser?: string;
  parameters?: Record<string, string | boolean | number>;
}

export interface JenkinsTelegramNotificationResult {
  attempted: boolean;
  sent: boolean;
  error?: string;
}

interface TelegramSendMessageResponse {
  ok: boolean;
  description?: string;
}

export function isJenkinsTelegramConfigured(config: JenkinsTelegramConfig): boolean {
  return Boolean(config.enabled && config.botToken.trim() && config.chatId.trim());
}

export async function loadJenkinsTelegramConfig(): Promise<JenkinsTelegramConfig> {
  const [enabled, botTokenValue, chatId, releaseKeywords] = await Promise.all([
    getSetting('jenkins_tg_notification_enabled'),
    getSetting('jenkins_tg_bot_token'),
    getSetting('jenkins_tg_chat_id'),
    getSetting('jenkins_tg_release_keywords'),
  ]);

  return {
    enabled: enabled ?? false,
    botToken: await decryptTelegramToken(botTokenValue),
    chatId: chatId ?? '',
    releaseKeywords: releaseKeywords ?? DEFAULT_JENKINS_TG_RELEASE_KEYWORDS,
  };
}

export async function saveJenkinsTelegramConfig(config: JenkinsTelegramConfig): Promise<void> {
  const botToken = config.botToken.trim();
  let storedBotToken: string | StoredEncryptedValue = '';

  if (botToken) {
    const encryptionKey = await loadKey();
    storedBotToken = encryptionKey ? await encryptData(botToken, encryptionKey) : botToken;
  }

  await Promise.all([
    updateSetting('jenkins_tg_notification_enabled', config.enabled),
    updateSetting('jenkins_tg_chat_id', config.chatId.trim()),
    updateSetting('jenkins_tg_release_keywords', config.releaseKeywords.trim()),
    updateSetting('jenkins_tg_bot_token', storedBotToken),
  ]);
}

export function isJenkinsReleaseBuild(
  context: Pick<JenkinsTelegramBuildContext, 'jobName' | 'jobUrl' | 'parameters'>,
  releaseKeywords: string
): boolean {
  const keywords = parseReleaseKeywords(releaseKeywords);
  if (keywords.length === 0) {
    return false;
  }

  const parameterText = context.parameters
    ? Object.entries(context.parameters)
        .map(([key, value]) => `${key} ${String(value)}`)
        .join(' ')
    : '';
  const targetText = `${context.jobName} ${context.jobUrl} ${parameterText}`.toLowerCase();

  return keywords.some((keyword) => targetText.includes(keyword.toLowerCase()));
}

export async function notifyTelegramForTriggeredBuild(args: {
  context: JenkinsTelegramBuildContext;
  notifyTelegram?: boolean;
}): Promise<JenkinsTelegramNotificationResult> {
  if (args.notifyTelegram === false) {
    return { attempted: false, sent: false };
  }

  const config = await loadJenkinsTelegramConfig();
  const configured = isJenkinsTelegramConfigured(config);
  const shouldNotify =
    args.notifyTelegram ?? isJenkinsReleaseBuild(args.context, config.releaseKeywords);

  if (!configured || !shouldNotify) {
    return { attempted: false, sent: false };
  }

  try {
    await sendJenkinsTelegramMessage(config, buildJenkinsTelegramMessage(args.context));
    return { attempted: true, sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[JenkinsTelegram] Failed to send notification:', message);
    return { attempted: true, sent: false, error: message };
  }
}

export async function sendJenkinsTelegramMessage(
  config: Pick<JenkinsTelegramConfig, 'botToken' | 'chatId'>,
  text: string
): Promise<void> {
  const botToken = config.botToken.trim();
  const chatId = config.chatId.trim();

  if (!botToken || !chatId) {
    throw new Error('Telegram Bot Token 或 Chat ID 未配置');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  let response: Response;

  try {
    response = await fetch(
      `https://api.telegram.org/bot${encodeURIComponent(botToken)}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          disable_web_page_preview: true,
        }),
        signal: controller.signal,
      }
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Telegram API 请求超时');
    }
    throw new Error('Telegram API 请求失败');
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`Telegram API ${response.status}: ${responseText.slice(0, 200)}`);
  }

  const body = (await response.json()) as TelegramSendMessageResponse;
  if (!body.ok) {
    throw new Error(body.description || 'Telegram API 返回失败');
  }
}

function buildJenkinsTelegramMessage(context: JenkinsTelegramBuildContext): string {
  const lines = [
    'Jenkins 发布构建已触发',
    `Job: ${context.jobName}`,
    `环境: ${context.envId || '-'}`,
    `触发人: ${context.jenkinsUser || '-'}`,
    `时间: ${new Date().toLocaleString('zh-CN', { hour12: false })}`,
    `地址: ${context.jobUrl}`,
  ];

  const parameterLines = formatNotificationParameters(context.parameters);
  if (parameterLines.length > 0) {
    lines.push('', '参数:', ...parameterLines);
  }

  return lines.join('\n');
}

function parseReleaseKeywords(releaseKeywords: string): string[] {
  return releaseKeywords
    .split(/[\s,，;；]+/)
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}

function formatNotificationParameters(
  parameters?: Record<string, string | boolean | number>
): string[] {
  if (!parameters) {
    return [];
  }

  return Object.entries(parameters)
    .slice(0, 8)
    .map(([key, value]) => {
      const safeValue = isSensitiveFieldName(key) ? '[redacted]' : String(value);
      return `- ${key}: ${safeValue}`;
    });
}

async function decryptTelegramToken(value: unknown): Promise<string> {
  if (!value) {
    return '';
  }

  try {
    const encryptionKey = await loadKey();
    if (encryptionKey && isStoredEncryptedValue(value)) {
      const decrypted = await decryptData(value, encryptionKey);
      return typeof decrypted === 'string' ? decrypted : '';
    }

    return typeof value === 'string' ? value : '';
  } catch (error) {
    logger.error('[JenkinsTelegram] Failed to decrypt bot token:', error);
    return '';
  }
}

function isStoredEncryptedValue(value: unknown): value is StoredEncryptedValue {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as { ciphertext?: unknown; iv?: unknown };
  return typeof candidate.ciphertext === 'string' && typeof candidate.iv === 'string';
}
