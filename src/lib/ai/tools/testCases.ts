import type {
  TestCaseDefinition,
  TestCaseMaterialInput,
  TestCaseStep,
  TestCaseTarget,
  TestCaseTestData,
} from '@/features/aiAssistant/materials/testCaseTypes';
import { createToolParameter, toolRegistry } from '@/lib/ai/tools';
import type { ToolHandler } from '@/lib/ai/tools';
import type { ToolProperty } from '@/lib/ai/types';
import {
  getTestCaseMaterial,
  importTestCaseMaterials,
  listTestCaseMaterialRecordsPage,
  updateTestCaseMaterial,
} from '@/lib/db';

const MAX_IMPORT_CASES = 50;

const targetProperty: ToolProperty = {
  type: 'object',
  description: '测试目标网页，按 order 顺序访问',
  properties: {
    id: { type: 'string', description: '目标网页唯一 ID' },
    order: { type: 'integer', description: '目标网页顺序，从 0 或 1 开始连续递增' },
    name: { type: 'string', description: '目标网页名称，可选' },
    url: { type: 'string', description: '明确的 HTTP(S) 目标 URL' },
  },
  required: ['id', 'order', 'url'],
  additionalProperties: false,
};

const testDataProperty: ToolProperty = {
  type: 'object',
  description: '测试过程中需要使用的输入数据；密码、Token 等必须标记 sensitive=true',
  properties: {
    name: { type: 'string', description: '数据名称' },
    value: { type: 'string', description: '数据值' },
    sensitive: { type: 'boolean', description: '是否为敏感数据' },
  },
  required: ['name', 'value', 'sensitive'],
  additionalProperties: false,
};

const stepProperty: ToolProperty = {
  type: 'object',
  description: '测试步骤，使用 target_id 关联目标网页',
  properties: {
    id: { type: 'string', description: '步骤唯一 ID' },
    order: { type: 'integer', description: '步骤顺序，从 0 或 1 开始连续递增' },
    target_id: { type: 'string', description: '所属目标网页 ID' },
    action: { type: 'string', description: '自然语言操作' },
    expected_result: { type: 'string', description: '自然语言预期结果，可选' },
  },
  required: ['id', 'order', 'target_id', 'action'],
  additionalProperties: false,
};

const definitionProperty: ToolProperty = {
  type: 'object',
  description: '可执行测试用例定义，字段保持自然语言表达',
  properties: {
    goal: { type: 'string', description: '测试目标' },
    targets: {
      type: 'array',
      description: '一个或多个按顺序访问的目标网页',
      items: targetProperty,
    },
    preconditions: {
      type: 'array',
      description: '执行前置条件，可为空数组',
      items: { type: 'string', description: '一条前置条件' },
    },
    test_data: {
      type: 'array',
      description: '测试输入数据，可为空数组',
      items: testDataProperty,
    },
    steps: {
      type: 'array',
      description: '按顺序执行的测试步骤',
      items: stepProperty,
    },
    overall_expected_result: { type: 'string', description: '整体预期结果，可选' },
  },
  required: ['goal', 'targets', 'preconditions', 'test_data', 'steps'],
  additionalProperties: false,
};

export function registerTestCaseTools(): void {
  toolRegistry.register({
    name: 'test_case_list',
    description: '列出团队共享测试用例的标题、ID、版本和更新时间，不返回测试数据明文。',
    parameters: createToolParameter(
      {
        page: { type: 'integer', minimum: 1, description: '页码，默认 1' },
        pageSize: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          description: '每页数量，默认 20，最大 100',
        },
      },
      []
    ),
    handler: (async (args: unknown) => {
      const page = await listTestCaseMaterialRecordsPage(readRecord(args));
      return {
        success: true,
        total: page.total,
        page: page.page,
        pageSize: page.pageSize,
        hasMore: page.hasMore,
        test_cases: page.items.map((material) => ({
          id: material.id,
          title: material.title,
          status: material.status,
          version: material.version,
          updatedAt: material.updatedAt,
        })),
      };
    }) as ToolHandler,
  });

  toolRegistry.register({
    name: 'test_case_get',
    description: '读取一个团队共享测试用例的完整结构和非敏感测试数据，供导入后的执行流程使用。',
    parameters: createToolParameter({ id: { type: 'string', description: '测试用例 ID' } }, ['id']),
    handler: (async (args: unknown) => {
      const id = readRequiredText(readRecord(args).id, '测试用例 ID');
      const material = await getTestCaseMaterial(id);
      if (!material) {
        throw new Error('测试用例不存在或已删除');
      }
      return {
        success: true,
        test_case: {
          id: material.id,
          title: material.title,
          status: material.status,
          version: material.version,
          definition: toToolDefinition(material.content.definition),
        },
      };
    }) as ToolHandler,
  });

  toolRegistry.register({
    name: 'test_case_import',
    description:
      '将一个或多个已完整解析的自然语言测试用例直接保存到团队共享测试用例库，不需要额外确认。',
    parameters: createToolParameter(
      {
        test_cases: {
          type: 'array',
          description: '一个或多个结构化测试用例；信息不完整时不要调用此工具',
          items: {
            type: 'object',
            description: '测试用例',
            properties: {
              title: { type: 'string', description: '测试用例标题' },
              source_text: { type: 'string', description: '用户提供的原始自然语言描述' },
              definition: definitionProperty,
            },
            required: ['title', 'source_text', 'definition'],
            additionalProperties: false,
          },
        },
      },
      ['test_cases']
    ),
    handler: (async (args: unknown) => {
      const record = readRecord(args);
      const rawCases = record.test_cases;
      if (!Array.isArray(rawCases) || rawCases.length === 0 || rawCases.length > MAX_IMPORT_CASES) {
        throw new Error(`test_case_import 一次需要 1-${MAX_IMPORT_CASES} 个测试用例`);
      }
      const inputs = rawCases.map((value) => parseMaterialInput(value));
      const materials = await importTestCaseMaterials(inputs);
      return {
        success: true,
        message: `已保存 ${materials.length} 条测试用例到团队共享库`,
        test_cases: materials.map((material) => ({
          id: material.id,
          title: material.title,
          version: material.version,
        })),
      };
    }) as ToolHandler,
  });

  toolRegistry.register({
    name: 'test_case_update',
    description:
      '根据用户确认的新定义更新一个已有的团队共享测试用例；必须先读取当前版本，再提交完整的新定义。',
    parameters: createToolParameter(
      {
        id: { type: 'string', description: '要更新的测试用例 ID' },
        expected_version: {
          type: 'integer',
          minimum: 1,
          description: '读取到的当前版本，防止覆盖他人更新',
        },
        title: { type: 'string', description: '新的测试用例标题' },
        source_text: { type: 'string', description: '新的自然语言描述，可选；不提供时保留原描述' },
        definition: definitionProperty,
      },
      ['id', 'expected_version', 'title', 'definition']
    ),
    handler: (async (args: unknown) => {
      const record = readRecord(args);
      const id = readRequiredText(record.id, '测试用例 ID');
      const expectedVersion = record.expected_version;
      if (typeof expectedVersion !== 'number' || !Number.isInteger(expectedVersion)) {
        throw new Error('expected_version 必须是整数');
      }
      const existing = await getTestCaseMaterial(id);
      if (!existing) throw new Error('测试用例不存在或已删除');
      const material = await updateTestCaseMaterial(
        id,
        parseMaterialInput({
          title: record.title,
          source_text: record.source_text ?? existing.content.sourceText,
          definition: restoreRedactedSensitiveData(record.definition, existing.content.definition),
        }),
        expectedVersion
      );
      return {
        success: true,
        message: `已更新测试用例：${material.title}`,
        test_case: { id: material.id, title: material.title, version: material.version },
      };
    }) as ToolHandler,
    requiresConfirmation: true,
  });
}

function parseMaterialInput(value: unknown): TestCaseMaterialInput {
  const record = readRecord(value);
  const definition = parseDefinition(record.definition);
  const sensitiveValues = definition.testData
    .filter((item) => item.sensitive && item.value)
    .map((item) => item.value);
  return {
    title: redactSensitiveText(readRequiredText(record.title, '测试用例标题'), sensitiveValues),
    sourceText: redactSensitiveText(
      readRequiredText(record.source_text, '测试用例原始描述'),
      sensitiveValues
    ),
    definition: redactDefinition(definition, sensitiveValues),
  };
}

function redactDefinition(
  definition: TestCaseDefinition,
  sensitiveValues: string[]
): TestCaseDefinition {
  const redact = (value: string): string => redactSensitiveText(value, sensitiveValues);
  return {
    ...definition,
    goal: redact(definition.goal),
    targets: definition.targets.map((target) => ({
      ...target,
      ...(target.name ? { name: redact(target.name) } : {}),
    })),
    preconditions: definition.preconditions.map(redact),
    steps: definition.steps.map((step) => ({
      ...step,
      action: redact(step.action),
      ...(step.expectedResult ? { expectedResult: redact(step.expectedResult) } : {}),
    })),
    ...(definition.overallExpectedResult
      ? { overallExpectedResult: redact(definition.overallExpectedResult) }
      : {}),
  };
}

function redactSensitiveText(value: string, sensitiveValues: string[]): string {
  return sensitiveValues
    .reduce((text, secret) => text.replaceAll(secret, '[redacted]'), value)
    .replace(
      /(api[-_]?key|private[-_]?key|access[-_]?key|encryption[-_]?key|token|password|passwd|pwd|secret|credential)\s*[:=]\s*([^\s,;]+)/gi,
      '$1=[redacted]'
    );
}

function parseDefinition(value: unknown): TestCaseDefinition {
  const record = readRecord(value);
  return {
    goal: readRequiredText(record.goal, '测试目标'),
    targets: readArray(record.targets, parseTarget),
    preconditions: readArray(record.preconditions, (item) => readRequiredText(item, '前置条件')),
    testData: readArray(record.test_data, parseTestData),
    steps: readArray(record.steps, parseStep),
    ...readOptionalField(record.overall_expected_result, '整体预期结果', 'overallExpectedResult'),
  };
}

function parseTarget(value: unknown): TestCaseTarget {
  const record = readRecord(value);
  return {
    id: readRequiredText(record.id, '目标网页 ID'),
    order: readRequiredInteger(record.order, '目标网页顺序'),
    ...readOptionalField(record.name, '目标网页名称', 'name'),
    url: readRequiredText(record.url, '目标 URL'),
  };
}

function parseTestData(value: unknown): TestCaseTestData {
  const record = readRecord(value);
  if (typeof record.sensitive !== 'boolean') {
    throw new Error('测试数据 sensitive 必须是布尔值');
  }
  return {
    name: readRequiredText(record.name, '测试数据名称'),
    value: readRequiredText(record.value, '测试数据值'),
    sensitive: record.sensitive,
  };
}

function parseStep(value: unknown): TestCaseStep {
  const record = readRecord(value);
  return {
    id: readRequiredText(record.id, '步骤 ID'),
    order: readRequiredInteger(record.order, '步骤顺序'),
    targetId: readRequiredText(record.target_id, '步骤目标网页 ID'),
    action: readRequiredText(record.action, '步骤操作'),
    ...readOptionalField(record.expected_result, '步骤预期结果', 'expectedResult'),
  };
}

function toToolDefinition(definition: TestCaseDefinition) {
  return {
    goal: definition.goal,
    targets: definition.targets,
    preconditions: definition.preconditions,
    test_data: definition.testData.map((item) => ({
      ...item,
      value: item.sensitive ? '[redacted]' : item.value,
    })),
    steps: definition.steps.map((step) => ({
      id: step.id,
      order: step.order,
      target_id: step.targetId,
      action: step.action,
      ...(step.expectedResult ? { expected_result: step.expectedResult } : {}),
    })),
    ...(definition.overallExpectedResult
      ? { overall_expected_result: definition.overallExpectedResult }
      : {}),
  };
}

function restoreRedactedSensitiveData(value: unknown, existing: TestCaseDefinition): unknown {
  const record = readRecord(value);
  const testData = readArray(record.test_data, (item) => readRecord(item));
  return {
    ...record,
    test_data: testData.map((item) => {
      if (item.value !== '[redacted]' || typeof item.name !== 'string') return item;
      const current = existing.testData.find(
        (candidate) => candidate.name === item.name && candidate.sensitive
      );
      return current ? { ...item, value: current.value, sensitive: true } : item;
    }),
  };
}

function readRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('测试用例参数必须是对象');
  }
  return value as Record<string, unknown>;
}

function readArray<T>(value: unknown, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) {
    throw new Error('测试用例数组字段格式无效');
  }
  return value.map(parse);
}

function readRequiredText(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label}不能为空`);
  }
  return value.trim();
}

function readRequiredInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error(`${label}必须是整数`);
  }
  return value;
}

function readOptionalField(value: unknown, label: string, key: string): Record<string, string> {
  if (value === undefined) return {};
  return { [key]: readRequiredText(value, label) };
}
