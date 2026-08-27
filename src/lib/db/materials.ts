import { db } from '@/db';
import type {
  DecryptedTestCaseMaterial,
  TestCaseDefinition,
  TestCaseMaterial,
  TestCaseMaterialInput,
  TestCaseStep,
  TestCaseTarget,
  TestCaseTestData,
} from '@/features/aiAssistant/materials/testCaseTypes';
import { decryptTestCaseContent, encryptTestCaseContent } from './testCaseShared';

const MAX_TITLE_LENGTH = 200;
const MAX_GOAL_LENGTH = 2_000;
const MAX_URL_LENGTH = 2_000;
const MAX_FIELD_LENGTH = 2_000;
const MAX_TARGETS = 50;
const MAX_PRECONDITIONS = 50;
const MAX_TEST_DATA = 50;
const MAX_IMPORT_CASES = 50;

export async function importTestCaseMaterial(
  input: TestCaseMaterialInput
): Promise<TestCaseMaterial> {
  const normalized = validateTestCaseMaterialInput(input);
  const now = Date.now();
  const material: TestCaseMaterial = {
    id: crypto.randomUUID(),
    type: 'testCase',
    title: normalized.title,
    status: 'ready',
    version: 1,
    encryptedContent: await encryptTestCaseContent({
      sourceText: normalized.sourceText,
      definition: normalized.definition,
    }),
    createdAt: now,
    updatedAt: now,
  };

  await db.materials.add(material);
  return material;
}

export async function updateTestCaseMaterial(
  id: string,
  input: TestCaseMaterialInput,
  expectedVersion: number
): Promise<TestCaseMaterial> {
  const normalized = validateTestCaseMaterialInput(input);
  const encryptedContent = await encryptTestCaseContent({
    sourceText: normalized.sourceText,
    definition: normalized.definition,
  });
  return db.transaction('rw', db.materials, async () => {
    const current = await db.materials.get(id);
    if (!current || current.deletedAt || current.status !== 'ready') {
      throw new Error('测试用例不存在或已归档');
    }
    if (current.version !== expectedVersion) {
      throw new Error(`测试用例已更新，请刷新后再保存（当前版本 v${current.version}）`);
    }

    const updated: TestCaseMaterial = {
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

export async function importTestCaseMaterials(
  inputs: TestCaseMaterialInput[]
): Promise<TestCaseMaterial[]> {
  if (inputs.length === 0 || inputs.length > MAX_IMPORT_CASES) {
    throw new Error(`一次必须导入 1-${MAX_IMPORT_CASES} 个测试用例`);
  }

  const materials = await Promise.all(inputs.map((input) => buildTestCaseMaterial(input)));
  await db.transaction('rw', db.materials, async () => {
    await db.materials.bulkAdd(materials);
  });
  return materials;
}

export async function getTestCaseMaterial(
  id: string
): Promise<DecryptedTestCaseMaterial | undefined> {
  const material = await db.materials.get(id);
  if (!material || material.deletedAt || material.status !== 'ready') {
    return undefined;
  }

  const content = await decryptTestCaseContent<DecryptedTestCaseMaterial['content']>(
    material.encryptedContent
  );
  return { ...material, content };
}

export async function listTestCaseMaterialRecords(): Promise<TestCaseMaterial[]> {
  const materials = await db.materials
    .where('type')
    .equals('testCase')
    .and((material) => material.status === 'ready' && !material.deletedAt)
    .sortBy('updatedAt');
  return materials.reverse();
}

export async function listTestCaseMaterials(): Promise<DecryptedTestCaseMaterial[]> {
  const materials = await listTestCaseMaterialRecords();
  const decrypted = await Promise.all(
    materials.map(async (material) => ({
      ...material,
      content: await decryptTestCaseContent<DecryptedTestCaseMaterial['content']>(
        material.encryptedContent
      ),
    }))
  );
  return decrypted;
}

function validateTestCaseMaterialInput(input: TestCaseMaterialInput): TestCaseMaterialInput {
  const title = requireText(input.title, '测试用例标题', MAX_TITLE_LENGTH);
  const sourceText = requireText(input.sourceText, '测试用例原始描述');
  return { title, sourceText, definition: validateDefinition(input.definition) };
}

function validateDefinition(definition: TestCaseDefinition): TestCaseDefinition {
  if (!definition || typeof definition !== 'object') {
    throw new Error('测试用例 definition 必须是对象');
  }

  const goal = requireText(definition.goal, '测试目标', MAX_GOAL_LENGTH);
  const targets = validateTargets(definition.targets);
  const targetIds = new Set(targets.map((target) => target.id));
  const steps = validateSteps(definition.steps, targetIds);
  const preconditions = validateTextList(definition.preconditions, '前置条件', MAX_PRECONDITIONS);
  const testData = validateTestData(definition.testData);
  const overallExpectedResult = optionalText(
    definition.overallExpectedResult,
    '整体预期结果',
    MAX_FIELD_LENGTH
  );

  return {
    goal,
    targets,
    preconditions,
    testData,
    steps,
    ...(overallExpectedResult ? { overallExpectedResult } : {}),
  };
}

function validateTargets(targets: TestCaseTarget[]): TestCaseTarget[] {
  if (!Array.isArray(targets) || targets.length === 0 || targets.length > MAX_TARGETS) {
    throw new Error(`测试用例必须包含 1-${MAX_TARGETS} 个目标网页`);
  }

  const ids = new Set<string>();
  const firstOrder = targets[0]?.order;
  if (firstOrder !== 0 && firstOrder !== 1) {
    throw new Error('目标网页 order 必须从 0 或 1 开始');
  }
  return targets.map((target, index) => {
    if (!target || typeof target !== 'object') {
      throw new Error('目标网页格式无效');
    }
    if (target.order !== firstOrder + index) {
      throw new Error('目标网页 order 必须连续递增');
    }
    const id = requireText(target.id, '目标网页 ID', MAX_FIELD_LENGTH);
    if (ids.has(id)) {
      throw new Error(`目标网页 ID 重复：${id}`);
    }
    ids.add(id);

    const url = requireText(target.url, '目标 URL', MAX_URL_LENGTH);
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new Error(`第 ${index + 1} 个目标 URL 无效`);
    }
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error(`第 ${index + 1} 个目标 URL 必须使用 HTTP(S)`);
    }

    const name = optionalText(target.name, '目标网页名称', MAX_FIELD_LENGTH);
    return { id, order: target.order, url, ...(name ? { name } : {}) };
  });
}

function validateSteps(steps: TestCaseStep[], targetIds: Set<string>): TestCaseStep[] {
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new Error('测试用例必须包含至少 1 个步骤');
  }

  const ids = new Set<string>();
  const firstOrder = steps[0]?.order;
  if (firstOrder !== 0 && firstOrder !== 1) {
    throw new Error('步骤 order 必须从 0 或 1 开始');
  }
  return steps.map((step, index) => {
    if (!step || typeof step !== 'object' || step.order !== firstOrder + index) {
      throw new Error('步骤格式无效，order 必须连续递增');
    }
    const id = requireText(step.id, '步骤 ID', MAX_FIELD_LENGTH);
    if (ids.has(id)) {
      throw new Error(`步骤 ID 重复：${id}`);
    }
    ids.add(id);
    const targetId = requireText(step.targetId, '步骤目标网页 ID', MAX_FIELD_LENGTH);
    if (!targetIds.has(targetId)) {
      throw new Error(`步骤关联了不存在的目标网页：${targetId}`);
    }
    const action = requireText(step.action, '步骤操作', MAX_FIELD_LENGTH);
    const expectedResult = optionalText(step.expectedResult, '步骤预期结果', MAX_FIELD_LENGTH);
    return {
      id,
      order: step.order,
      targetId,
      action,
      ...(expectedResult ? { expectedResult } : {}),
    };
  });
}

function validateTextList(values: string[], label: string, maxItems: number): string[] {
  if (!Array.isArray(values) || values.length > maxItems) {
    throw new Error(`${label}最多 ${maxItems} 条`);
  }
  return values.map((value) => requireText(value, label, MAX_FIELD_LENGTH));
}

function validateTestData(values: TestCaseTestData[]): TestCaseTestData[] {
  if (!Array.isArray(values) || values.length > MAX_TEST_DATA) {
    throw new Error(`测试数据最多 ${MAX_TEST_DATA} 条`);
  }
  return values.map((item) => {
    if (!item || typeof item !== 'object') {
      throw new Error('测试数据格式无效');
    }
    if (item.sensitive !== true && item.sensitive !== false) {
      throw new Error('测试数据 sensitive 必须是布尔值');
    }
    return {
      name: requireText(item.name, '测试数据名称', MAX_FIELD_LENGTH),
      value: requireText(item.value, '测试数据值', MAX_FIELD_LENGTH),
      sensitive: item.sensitive,
    };
  });
}

function requireText(value: string, label: string, maxLength?: number): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label}不能为空`);
  }
  const normalized = value.trim();
  if (maxLength !== undefined && normalized.length > maxLength) {
    throw new Error(`${label}最多 ${maxLength} 个字符`);
  }
  return normalized;
}

function optionalText(
  value: string | undefined,
  label: string,
  maxLength: number
): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new Error(`${label}格式无效`);
  }
  if (value.trim() === '') return undefined;
  return requireText(value, label, maxLength);
}

async function buildTestCaseMaterial(input: TestCaseMaterialInput): Promise<TestCaseMaterial> {
  const normalized = validateTestCaseMaterialInput(input);
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    type: 'testCase',
    title: normalized.title,
    status: 'ready',
    version: 1,
    encryptedContent: await encryptTestCaseContent({
      sourceText: normalized.sourceText,
      definition: normalized.definition,
    }),
    createdAt: now,
    updatedAt: now,
  };
}
