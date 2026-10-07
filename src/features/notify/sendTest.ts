import { canonicalChatId } from './canonical.ts';
import type { TelegramLogFile, TelegramSendResult } from './telegram.ts';
import { notifyTemplateSource } from './template.ts';

export interface NotifyTestDraft {
  botToken: string;
  messageTemplate?: string;
  targets: Array<{ id: string; kind: string; label: string; chatId: string }>;
}

interface SavedTarget {
  id: string;
  kind: string;
  label: string;
  chatId: string;
}

export interface SendNotifyTestPorts {
  loadToken(): Promise<string>;
  loadTemplate(): Promise<string>;
  loadTargets(): Promise<SavedTarget[]>;
  send(
    token: string,
    chatId: string,
    text: string,
    file?: TelegramLogFile
  ): Promise<TelegramSendResult>;
}

function storedTemplate(value: string | undefined): string {
  return notifyTemplateSource(value ?? '');
}

function matchesSaved(
  draft: NotifyTestDraft,
  token: string,
  template: string,
  saved: SavedTarget[]
): boolean {
  if (draft.botToken.trim() !== token) return false;
  if (storedTemplate(draft.messageTemplate) !== storedTemplate(template)) return false;
  if (draft.targets.length !== saved.length) return false;
  const byId = new Map(saved.map((row) => [row.id, row]));
  return draft.targets.every((target) => {
    const row = byId.get(target.id);
    const chatId = canonicalChatId(target.chatId);
    return (
      row !== undefined &&
      chatId !== null &&
      row.kind === target.kind &&
      row.label === target.label.trim() &&
      row.chatId === chatId
    );
  });
}

/** 只给已保存的接收对象发一条试消息，不写游标，也不占用构建去重。 */
export async function sendNotifyTest(
  draft: NotifyTestDraft,
  ports: SendNotifyTestPorts
): Promise<number> {
  const token = (await ports.loadToken()).trim();
  const template = await ports.loadTemplate();
  const saved = await ports.loadTargets();
  if (!matchesSaved(draft, token, template, saved)) throw new Error('请先保存再试发');
  if (!token || saved.length === 0) throw new Error('请先保存机器人 Token 和接收对象');
  const text = notifyTemplateSource(template);

  for (const target of saved) {
    const name = target.label.trim() || target.chatId;
    const result = await ports.send(token, target.chatId, text);
    if (result === 'ok') continue;
    if (result === 'token_dead') throw new Error('机器人 Token 无效');
    if (result === 'permanent') {
      throw new Error(`发不到「${name}」。用户要先给机器人发过一句话，群里要先把机器人加进去`);
    }
    throw new Error(`发给「${name}」失败，请稍后再试`);
  }
  return saved.length;
}
