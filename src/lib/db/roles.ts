import { db } from '@/db';
import type {
  DecryptedRoleMaterial,
  RoleMaterial,
  RoleMaterialContent,
  RoleMaterialInput,
  RoleToolPolicy,
} from '@/features/aiAssistant/materials/testCaseTypes';
import { decryptMaterialContent, encryptMaterialContent } from './testCaseShared';

const MAX_TITLE_LENGTH = 80;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_SYSTEM_PROMPT_LENGTH = 32_000;
const MAX_TOOL_NAMES = 200;
const MAX_TOOL_NAME_LENGTH = 128;

export async function createRoleMaterial(input: RoleMaterialInput): Promise<RoleMaterial> {
  const normalized = validateRoleMaterialInput(input);
  const now = Date.now();
  const material: RoleMaterial = {
    id: crypto.randomUUID(),
    type: 'role',
    title: normalized.title,
    status: 'ready',
    version: 1,
    encryptedContent: await encryptMaterialContent(toRoleContent(normalized)),
    createdAt: now,
    updatedAt: now,
  };
  await db.materials.add(material);
  return material;
}

export async function updateRoleMaterial(
  id: string,
  input: RoleMaterialInput,
  expectedVersion: number
): Promise<RoleMaterial> {
  const normalized = validateRoleMaterialInput(input);
  const encryptedContent = await encryptMaterialContent(toRoleContent(normalized));
  return await db.transaction('rw', db.materials, async () => {
    const current = await db.materials.get(id);
    if (!current || current.type !== 'role' || current.deletedAt || current.status !== 'ready') {
      throw new Error('角色不存在或已归档');
    }
    if (current.version !== expectedVersion) {
      throw new Error(`角色已更新，请刷新后再保存（当前版本 v${current.version}）`);
    }
    const updated: RoleMaterial = {
      ...current,
      title: normalized.title,
      version: current.version + 1,
      encryptedContent,
      updatedAt: Date.now(),
    };
    await db.materials.put(updated);
    return updated;
  });
}

export async function archiveRoleMaterial(id: string): Promise<void> {
  await db.transaction('rw', db.materials, async () => {
    const material = await db.materials.get(id);
    if (!material || material.type !== 'role' || material.deletedAt) {
      throw new Error('角色不存在或已归档');
    }
    const now = Date.now();
    await db.materials.update(id, { status: 'archived', deletedAt: now, updatedAt: now });
  });
}

export async function getRoleMaterial(id: string): Promise<DecryptedRoleMaterial | undefined> {
  const material = await db.materials.get(id);
  if (!material || material.type !== 'role' || material.deletedAt || material.status !== 'ready') {
    return undefined;
  }
  const content = await decryptMaterialContent<RoleMaterialContent>(material.encryptedContent);
  return { ...material, content };
}

export async function listRoleMaterialRecords(): Promise<RoleMaterial[]> {
  const materials = await db.materials
    .where('type')
    .equals('role')
    .and((material) => material.status === 'ready' && !material.deletedAt)
    .sortBy('updatedAt');
  return materials
    .filter((material): material is RoleMaterial => material.type === 'role')
    .reverse();
}

export async function listRoleMaterials(): Promise<DecryptedRoleMaterial[]> {
  const records = await listRoleMaterialRecords();
  return await Promise.all(
    records.map(async (record) => ({
      ...record,
      content: await decryptMaterialContent<RoleMaterialContent>(record.encryptedContent),
    }))
  );
}

export function validateRoleMaterialInput(input: RoleMaterialInput): RoleMaterialInput {
  if (!input || typeof input !== 'object') throw new Error('角色内容格式无效');
  if (typeof input.systemPrompt !== 'string') throw new Error('System Prompt 必须是文本');
  if (input.systemPrompt.length > MAX_SYSTEM_PROMPT_LENGTH) {
    throw new Error(`System Prompt 不能超过 ${MAX_SYSTEM_PROMPT_LENGTH} 个字符`);
  }
  return {
    title: requireText(input.title, '角色名称', MAX_TITLE_LENGTH),
    ...(optionalText(input.description, '角色描述', MAX_DESCRIPTION_LENGTH)
      ? { description: optionalText(input.description, '角色描述', MAX_DESCRIPTION_LENGTH) }
      : {}),
    systemPrompt: input.systemPrompt,
    toolPolicy: validateToolPolicy(input.toolPolicy),
  };
}

function validateToolPolicy(policy: RoleToolPolicy): RoleToolPolicy {
  if (!policy || typeof policy !== 'object') throw new Error('角色工具配置无效');
  if (policy.mode === 'all') return { mode: 'all' };
  if (policy.mode !== 'allowlist' || !Array.isArray(policy.toolNames)) {
    throw new Error('角色工具配置无效');
  }
  if (policy.toolNames.length > MAX_TOOL_NAMES) {
    throw new Error(`角色最多配置 ${MAX_TOOL_NAMES} 个工具`);
  }
  const toolNames = policy.toolNames.map((name) =>
    requireText(name, '工具名称', MAX_TOOL_NAME_LENGTH)
  );
  return { mode: 'allowlist', toolNames: [...new Set(toolNames)] };
}

function toRoleContent(input: RoleMaterialInput): RoleMaterialContent {
  return {
    ...(input.description ? { description: input.description } : {}),
    systemPrompt: input.systemPrompt,
    toolPolicy: input.toolPolicy,
  };
}

function requireText(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label}不能为空`);
  const normalized = value.trim();
  if (normalized.length > maxLength) throw new Error(`${label}不能超过 ${maxLength} 个字符`);
  return normalized;
}

function optionalText(value: unknown, label: string, maxLength: number): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return requireText(value, label, maxLength);
}
