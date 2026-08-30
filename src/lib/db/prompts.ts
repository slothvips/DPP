import { db } from '@/db';
import { extractPromptVariableKeys } from '@/features/aiAssistant/materials/promptTemplate';
import type {
  DecryptedPromptMaterial,
  MaterialRecord,
  PromptMaterial,
  PromptMaterialContent,
  PromptMaterialInput,
  PromptVariable,
} from '@/features/aiAssistant/materials/testCaseTypes';
import { type PageResult, normalizePage } from './pagination';
import { ensureTagsExist } from './tagsMutations';
import { decryptMaterialContent, encryptMaterialContent } from './testCaseShared';

export {
  extractPromptVariableKeys,
  renderPromptTemplate,
} from '@/features/aiAssistant/materials/promptTemplate';

const MAX_TITLE_LENGTH = 200;
const MAX_BODY_LENGTH = 32_000;
const MAX_SUMMARY_LENGTH = 500;
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 50;
const MAX_VARIABLES = 30;
const MAX_VARIABLE_KEY_LENGTH = 64;
const MAX_VARIABLE_LABEL_LENGTH = 100;
const MAX_VARIABLE_DESCRIPTION_LENGTH = 500;
const MAX_VARIABLE_DEFAULT_LENGTH = 2_000;

export async function createPromptMaterial(input: PromptMaterialInput): Promise<PromptMaterial> {
  const normalized = validatePromptMaterialInput(input);
  await ensureTagsExist(normalized.tags);
  const now = Date.now();
  const material: PromptMaterial = {
    id: crypto.randomUUID(),
    type: 'prompt',
    title: normalized.title,
    status: 'ready',
    version: 1,
    encryptedContent: await encryptMaterialContent(toPromptContent(normalized)),
    createdAt: now,
    updatedAt: now,
  };

  await db.materials.add(material);
  return material;
}

export async function updatePromptMaterial(
  id: string,
  input: PromptMaterialInput,
  expectedVersion: number
): Promise<PromptMaterial> {
  const normalized = validatePromptMaterialInput(input);
  await ensureTagsExist(normalized.tags);
  const encryptedContent = await encryptMaterialContent(toPromptContent(normalized));

  return await db.transaction('rw', db.materials, async () => {
    const current = await db.materials.get(id);
    if (!current || current.type !== 'prompt' || current.deletedAt || current.status !== 'ready') {
      throw new Error('提示词不存在或已归档');
    }
    if (current.version !== expectedVersion) {
      throw new Error(`提示词已更新，请刷新后再保存（当前版本 v${current.version}）`);
    }

    const updated: PromptMaterial = {
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

export async function archivePromptMaterial(id: string): Promise<void> {
  await db.transaction('rw', db.materials, async () => {
    const material = await db.materials.get(id);
    if (!material || material.type !== 'prompt' || material.deletedAt) {
      throw new Error('提示词不存在或已归档');
    }

    const now = Date.now();
    await db.materials.update(id, {
      status: 'archived',
      deletedAt: now,
      updatedAt: now,
    });
  });
}

export async function getPromptMaterial(id: string): Promise<DecryptedPromptMaterial | undefined> {
  const material = await db.materials.get(id);
  if (
    !material ||
    material.type !== 'prompt' ||
    material.deletedAt ||
    material.status !== 'ready'
  ) {
    return undefined;
  }

  const content = await decryptAndNormalizePromptContent(material.encryptedContent);
  return { ...material, content };
}

export async function listPromptMaterialRecords(): Promise<PromptMaterial[]> {
  const materials = await db.materials
    .where('type')
    .equals('prompt')
    .and((material) => material.status === 'ready' && !material.deletedAt)
    .sortBy('updatedAt');
  return materials.filter(isPromptMaterial).reverse();
}

export async function listPromptMaterialRecordsPage(
  args: { page?: number; pageSize?: number } = {}
): Promise<PageResult<PromptMaterial>> {
  const { page, pageSize, offset } = normalizePage(args, 20, 100);
  const query = db.materials.where('type').equals('prompt');
  const total = await query
    .and((material) => material.status === 'ready' && !material.deletedAt)
    .count();
  const items = (
    await db.materials
      .orderBy('updatedAt')
      .reverse()
      .filter(
        (material) =>
          material.type === 'prompt' && material.status === 'ready' && !material.deletedAt
      )
      .offset(offset)
      .limit(pageSize)
      .toArray()
  ).filter(isPromptMaterial);
  return { items, total, page, pageSize, hasMore: offset + pageSize < total };
}

export async function listPromptMaterials(): Promise<DecryptedPromptMaterial[]> {
  const records = await listPromptMaterialRecords();
  return await Promise.all(
    records.map(async (material) => ({
      ...material,
      content: await decryptAndNormalizePromptContent(material.encryptedContent),
    }))
  );
}

async function decryptAndNormalizePromptContent(
  encryptedContent: PromptMaterial['encryptedContent']
): Promise<PromptMaterialContent> {
  const decrypted = await decryptMaterialContent<PromptMaterialContent & { category?: string }>(
    encryptedContent
  );
  const content = { ...decrypted };
  delete content.category;
  return content;
}

export function validatePromptMaterialInput(input: PromptMaterialInput): PromptMaterialInput {
  if (!input || typeof input !== 'object') {
    throw new Error('提示词内容格式无效');
  }

  const title = requireText(input.title, '提示词标题', MAX_TITLE_LENGTH);
  const body = requireText(input.body, '提示词正文', MAX_BODY_LENGTH);
  const summary = optionalText(input.summary, '提示词摘要', MAX_SUMMARY_LENGTH);
  const tags = validateTags(input.tags);
  const variables = validateVariables(input.variables, body);

  return {
    title,
    body,
    ...(summary ? { summary } : {}),
    tags,
    variables,
  };
}

function toPromptContent(input: PromptMaterialInput): PromptMaterialContent {
  return {
    body: input.body,
    ...(input.summary ? { summary: input.summary } : {}),
    tags: input.tags,
    variables: input.variables,
  };
}

function validateTags(tags: string[]): string[] {
  if (!Array.isArray(tags) || tags.length > MAX_TAGS) {
    throw new Error(`提示词最多包含 ${MAX_TAGS} 个标签`);
  }

  const normalized = tags.map((tag) => requireText(tag, '提示词标签', MAX_TAG_LENGTH));
  return [...new Set(normalized)];
}

function validateVariables(variables: PromptVariable[], body: string): PromptVariable[] {
  if (!Array.isArray(variables) || variables.length > MAX_VARIABLES) {
    throw new Error(`提示词最多包含 ${MAX_VARIABLES} 个变量`);
  }

  const keys = new Set<string>();
  const normalized = variables.map((variable) => {
    if (!variable || typeof variable !== 'object') {
      throw new Error('提示词变量格式无效');
    }
    const key = requireText(variable.key, '提示词变量名', MAX_VARIABLE_KEY_LENGTH);
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      throw new Error(`提示词变量名无效：${key}`);
    }
    if (keys.has(key)) {
      throw new Error(`提示词变量名重复：${key}`);
    }
    keys.add(key);

    const label = requireText(variable.label, `变量 ${key} 的名称`, MAX_VARIABLE_LABEL_LENGTH);
    const description = optionalText(
      variable.description,
      `变量 ${key} 的说明`,
      MAX_VARIABLE_DESCRIPTION_LENGTH
    );
    const defaultValue = optionalText(
      variable.defaultValue,
      `变量 ${key} 的默认值`,
      MAX_VARIABLE_DEFAULT_LENGTH
    );
    const required = variable.required === true;
    const sensitive = variable.sensitive === true;
    if (sensitive && defaultValue) {
      throw new Error(`敏感变量“${label}”不能保存默认值`);
    }

    return {
      key,
      label,
      ...(description ? { description } : {}),
      required,
      ...(defaultValue ? { defaultValue } : {}),
      ...(sensitive ? { sensitive: true } : {}),
    };
  });

  const declared = new Set(normalized.map((variable) => variable.key));
  for (const key of extractPromptVariableKeys(body)) {
    if (!declared.has(key)) {
      throw new Error(`正文中的变量“${key}”尚未定义`);
    }
  }
  return normalized;
}

function requireText(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label}不能为空`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new Error(`${label}不能超过 ${maxLength} 个字符`);
  }
  return normalized;
}

function optionalText(value: unknown, label: string, maxLength: number): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return requireText(value, label, maxLength);
}

function isPromptMaterial(material: MaterialRecord): material is PromptMaterial {
  return material.type === 'prompt';
}
