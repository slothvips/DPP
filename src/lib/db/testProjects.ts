import { db } from '@/db';
import type {
  DecryptedTestProject,
  TestCaseMaterial,
  TestCaseMaterialInput,
  TestProject,
  TestProjectCaseReference,
  TestProjectContent,
} from '@/features/aiAssistant/materials/testCaseTypes';
import { buildTestCaseMaterials } from './materials';
import { decryptTestCaseContent, encryptTestCaseContent } from './testCaseShared';

const MAX_PROJECT_TITLE_LENGTH = 200;
const MAX_PROJECT_DESCRIPTION_LENGTH = 2_000;
const MAX_PROJECT_CASES = 200;

export interface TestProjectInput {
  title: string;
  description?: string;
  testCases: TestProjectCaseReference[];
}

export interface ImportedTestProject {
  project: TestProject;
  testCases: TestCaseMaterial[];
}

export async function createTestProject(input: {
  title: string;
  description?: string;
}): Promise<TestProject> {
  const requestedTitle = requireText(input.title, '项目名称', MAX_PROJECT_TITLE_LENGTH);
  const description = optionalText(input.description, '项目描述', MAX_PROJECT_DESCRIPTION_LENGTH);
  const now = Date.now();
  const content: TestProjectContent = {
    ...(description ? { description } : {}),
    testCases: [],
  };
  const encryptedContent = await encryptTestCaseContent(content);

  return await db.transaction('rw', db.testProjects, async () => {
    const project: TestProject = {
      id: crypto.randomUUID(),
      title: await createUniqueProjectTitle(requestedTitle, now),
      status: 'ready',
      version: 1,
      encryptedContent,
      createdAt: now,
      updatedAt: now,
    };
    await db.testProjects.add(project);
    return project;
  });
}

export async function createTestCaseInProject(
  projectId: string,
  input: TestCaseMaterialInput
): Promise<ImportedTestProject> {
  const [testCase] = await buildTestCaseMaterials([input]);
  if (!testCase) throw new Error('测试用例创建失败');

  return await db.transaction('rw', db.materials, db.testProjects, async () => {
    const current = await db.testProjects.get(projectId);
    if (!current || current.deletedAt || current.status !== 'ready') {
      throw new Error('测试项目不存在或已删除');
    }
    const currentContent = await decryptTestCaseContent<TestProjectContent>(
      current.encryptedContent
    );
    if (currentContent.testCases.length >= MAX_PROJECT_CASES) {
      throw new Error(`测试项目最多包含 ${MAX_PROJECT_CASES} 条测试用例`);
    }

    const now = Date.now();
    const project: TestProject = {
      ...current,
      version: current.version + 1,
      baseVersion: current.version,
      encryptedContent: await encryptTestCaseContent({
        ...currentContent,
        testCases: [
          ...currentContent.testCases,
          {
            testCaseMaterialId: testCase.id,
            order: currentContent.testCases.length + 1,
            enabled: true,
          },
        ],
      }),
      updatedAt: now,
    };
    await db.materials.add(testCase);
    await db.testProjects.put(project);
    return { project, testCases: [testCase] };
  });
}

export async function importTestProject(
  input: { title: string; description?: string },
  testCaseInputs: TestCaseMaterialInput[],
  existingProjectId?: string
): Promise<ImportedTestProject> {
  const testCases = await buildTestCaseMaterials(testCaseInputs);
  const description = optionalText(input.description, '项目描述', MAX_PROJECT_DESCRIPTION_LENGTH);
  const requestedTitle = requireText(input.title, '项目名称', MAX_PROJECT_TITLE_LENGTH);
  const existing = existingProjectId ? await getTestProject(existingProjectId) : undefined;
  if (existingProjectId && !existing) throw new Error('指定的测试项目不存在或已删除');

  const now = Date.now();
  const appendedReferences = testCases.map((testCase, index) => ({
    testCaseMaterialId: testCase.id,
    order: (existing?.content.testCases.length ?? 0) + index + 1,
    enabled: true,
  }));
  if ((existing?.content.testCases.length ?? 0) + appendedReferences.length > MAX_PROJECT_CASES) {
    throw new Error(`测试项目最多包含 ${MAX_PROJECT_CASES} 条测试用例`);
  }
  const content: TestProjectContent = existing
    ? {
        ...existing.content,
        testCases: [...existing.content.testCases, ...appendedReferences],
      }
    : {
        ...(description ? { description } : {}),
        testCases: appendedReferences,
      };
  const encryptedContent = await encryptTestCaseContent(content);

  return await db.transaction('rw', db.materials, db.testProjects, async () => {
    await db.materials.bulkAdd(testCases);
    if (existing) {
      const current = await db.testProjects.get(existing.id);
      if (!current || current.version !== existing.version || current.deletedAt) {
        throw new Error('测试项目已更新，请重试导入');
      }
      const project: TestProject = {
        ...current,
        version: current.version + 1,
        baseVersion: current.version,
        encryptedContent,
        updatedAt: now,
      };
      await db.testProjects.put(project);
      return { project, testCases };
    }

    const title = await createUniqueProjectTitle(requestedTitle, now);
    const project: TestProject = {
      id: crypto.randomUUID(),
      title,
      status: 'ready',
      version: 1,
      encryptedContent,
      createdAt: now,
      updatedAt: now,
    };
    await db.testProjects.add(project);
    return { project, testCases };
  });
}

export async function getTestProject(id: string): Promise<DecryptedTestProject | undefined> {
  const project = await db.testProjects.get(id);
  if (!project || project.deletedAt || project.status !== 'ready') return undefined;
  const content = await decryptTestCaseContent<TestProjectContent>(project.encryptedContent);
  return { ...project, content };
}

export async function listTestProjectRecords(): Promise<TestProject[]> {
  return await db.testProjects
    .orderBy('updatedAt')
    .reverse()
    .filter((project) => project.status === 'ready' && !project.deletedAt)
    .toArray();
}

export async function listTestProjects(): Promise<DecryptedTestProject[]> {
  return await Promise.all(
    (await listTestProjectRecords()).map(async (project) => ({
      ...project,
      content: await decryptTestCaseContent<TestProjectContent>(project.encryptedContent),
    }))
  );
}

export async function updateTestProject(
  id: string,
  input: TestProjectInput,
  expectedVersion: number
): Promise<TestProject> {
  const title = requireText(input.title, '项目名称', MAX_PROJECT_TITLE_LENGTH);
  const content: TestProjectContent = {
    ...optionalContentDescription(input.description),
    testCases: validateReferences(input.testCases),
  };
  const encryptedContent = await encryptTestCaseContent(content);
  return await db.transaction('rw', db.testProjects, async () => {
    const current = await db.testProjects.get(id);
    if (!current || current.deletedAt || current.status !== 'ready') {
      throw new Error('测试项目不存在或已删除');
    }
    if (current.version !== expectedVersion) throw new Error('测试项目已更新，请刷新后再保存');
    const project: TestProject = {
      ...current,
      title,
      version: current.version + 1,
      baseVersion: current.version,
      encryptedContent,
      updatedAt: Date.now(),
    };
    await db.testProjects.put(project);
    return project;
  });
}

export async function deleteTestProject(id: string): Promise<void> {
  await db.transaction('rw', db.testProjects, async () => {
    const current = await db.testProjects.get(id);
    if (!current || current.deletedAt) throw new Error('测试项目不存在或已删除');
    const now = Date.now();
    await db.testProjects.put({ ...current, status: 'archived', deletedAt: now, updatedAt: now });
  });
}

async function createUniqueProjectTitle(title: string, now: number): Promise<string> {
  const titles = new Set((await db.testProjects.toArray()).map((project) => project.title));
  if (!titles.has(title)) return title;
  const date = new Date(now);
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
    '-',
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
    String(date.getSeconds()).padStart(2, '0'),
  ].join('');
  const suffixed = `${title}-${stamp}`;
  if (!titles.has(suffixed)) return suffixed;
  for (let index = 2; ; index += 1) {
    const candidate = `${suffixed}-${index}`;
    if (!titles.has(candidate)) return candidate;
  }
}

function validateReferences(references: TestProjectCaseReference[]): TestProjectCaseReference[] {
  if (!Array.isArray(references) || references.length > MAX_PROJECT_CASES) {
    throw new Error(`测试项目最多包含 ${MAX_PROJECT_CASES} 条测试用例`);
  }
  const ids = new Set<string>();
  return references.map((reference, index) => {
    const id = requireText(reference.testCaseMaterialId, '测试用例 ID', 100);
    if (ids.has(id)) throw new Error(`测试项目不能重复引用测试用例：${id}`);
    ids.add(id);
    return { testCaseMaterialId: id, order: index + 1, enabled: reference.enabled === true };
  });
}

function optionalContentDescription(
  description: string | undefined
): Partial<Pick<TestProjectContent, 'description'>> {
  const value = optionalText(description, '项目描述', MAX_PROJECT_DESCRIPTION_LENGTH);
  return value ? { description: value } : {};
}

function requireText(value: string, label: string, maxLength: number): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label}不能为空`);
  if (normalized.length > maxLength) throw new Error(`${label}最多 ${maxLength} 个字符`);
  return normalized;
}

function optionalText(
  value: string | undefined,
  label: string,
  maxLength: number
): string | undefined {
  if (value === undefined || !value.trim()) return undefined;
  return requireText(value, label, maxLength);
}
