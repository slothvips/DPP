import { db } from '@/db';
import type {
  ConversationMaterial,
  ConversationMaterialContent,
  DecryptedConversationMaterial,
  MaterialRecord,
} from '@/features/aiAssistant/materials/testCaseTypes';
import type { ChatMessage } from '@/features/aiAssistant/types';
import { createSessionWithMessages } from './ai';
import { decryptMaterialContent, encryptMaterialContent } from './testCaseShared';

const MAX_CONVERSATION_MESSAGES = 500;
const MAX_CONVERSATION_TITLE_LENGTH = 200;
const MAX_CONVERSATION_SUMMARY_LENGTH = 500;

export interface CreateConversationMaterialInput {
  title: string;
  summary?: string;
  messages: ChatMessage[];
  role?: ConversationMaterialContent['role'];
}

export async function createConversationMaterial(
  input: CreateConversationMaterialInput
): Promise<ConversationMaterial> {
  const title = requireText(input.title, '会话标题', MAX_CONVERSATION_TITLE_LENGTH);
  const summary = optionalText(input.summary, '会话摘要', MAX_CONVERSATION_SUMMARY_LENGTH);
  if (!Array.isArray(input.messages) || input.messages.length === 0) {
    throw new Error('会话至少需要包含一条消息');
  }
  if (input.messages.length > MAX_CONVERSATION_MESSAGES) {
    throw new Error(`会话最多支持 ${MAX_CONVERSATION_MESSAGES} 条消息`);
  }

  const messages = structuredClone(input.messages);
  const content: ConversationMaterialContent = {
    ...(summary ? { summary } : {}),
    messages,
    ...(input.role ? { role: input.role } : {}),
  };
  const now = Date.now();
  const material: ConversationMaterial = {
    id: crypto.randomUUID(),
    type: 'conversation',
    immutable: true,
    title,
    status: 'ready',
    version: 1,
    encryptedContent: await encryptMaterialContent(content),
    createdAt: now,
    updatedAt: now,
  };

  await db.materials.add(material);
  return material;
}

export async function getConversationMaterial(
  id: string
): Promise<DecryptedConversationMaterial | undefined> {
  const material = await db.materials.get(id);
  if (!isConversationMaterial(material) || material.deletedAt || material.status !== 'ready') {
    return undefined;
  }

  const content = await decryptMaterialContent<ConversationMaterialContent>(
    material.encryptedContent
  );
  return { ...material, content };
}

export async function listConversationMaterialRecords(): Promise<ConversationMaterial[]> {
  const materials = await db.materials
    .where('type')
    .equals('conversation')
    .and((material) => material.status === 'ready' && !material.deletedAt)
    .sortBy('updatedAt');
  return materials.filter(isConversationMaterial).reverse();
}

export async function createSessionFromConversation(
  material: DecryptedConversationMaterial
): Promise<import('@/db/types').AISession> {
  const title = `基于：${material.title}`.slice(0, 30);
  return await createSessionWithMessages(title, material.content.messages, material.content.role);
}

function isConversationMaterial(
  material: MaterialRecord | undefined
): material is ConversationMaterial {
  return material?.type === 'conversation' && material.immutable === true;
}

function requireText(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label}不能为空`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new Error(`${label}最多 ${maxLength} 个字符`);
  }
  return normalized;
}

function optionalText(value: unknown, label: string, maxLength: number): string | undefined {
  if (value === undefined || value === '') return undefined;
  return requireText(value, label, maxLength);
}
