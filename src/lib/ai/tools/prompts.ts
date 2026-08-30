import type {
  PromptMaterialInput,
  PromptVariable,
} from '@/features/aiAssistant/materials/testCaseTypes';
import { createToolParameter, toolRegistry } from '@/lib/ai/tools';
import type { ToolHandler } from '@/lib/ai/tools';
import {
  archivePromptMaterial,
  createPromptMaterial,
  getPromptMaterial,
  listPromptMaterialRecordsPage,
  updatePromptMaterial,
  validatePromptMaterialInput,
} from '@/lib/db';

export function registerPromptTools(): void {
  toolRegistry.register({
    name: 'prompt_list',
    description: '列出团队共享提示词的标题、ID、版本和更新时间，不返回提示词正文。',
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
      const page = await listPromptMaterialRecordsPage(readRecord(args));
      return {
        success: true,
        total: page.total,
        page: page.page,
        pageSize: page.pageSize,
        hasMore: page.hasMore,
        prompts: page.items.map((prompt) => ({
          id: prompt.id,
          title: prompt.title,
          status: prompt.status,
          version: prompt.version,
          updatedAt: prompt.updatedAt,
        })),
      };
    }) as ToolHandler,
  });

  toolRegistry.register({
    name: 'prompt_get',
    description: '按 ID 读取一个团队共享提示词的正文、变量和标签。',
    parameters: createToolParameter({ id: { type: 'string', description: '提示词 ID' } }, ['id']),
    handler: (async (args: unknown) => {
      const id = readRequiredText(readRecord(args).id, '提示词 ID');
      const prompt = await getPromptMaterial(id);
      if (!prompt) throw new Error('提示词不存在或已归档');
      return {
        success: true,
        prompt: {
          id: prompt.id,
          title: prompt.title,
          status: prompt.status,
          version: prompt.version,
          content: prompt.content,
        },
      };
    }) as ToolHandler,
  });

  toolRegistry.register({
    name: 'prompt_create',
    description: '将完整提示词保存到团队共享物料库；保存前必须确认正文和变量信息完整。',
    parameters: promptInputParameter(),
    handler: (async (args: unknown) => {
      const prompt = await createPromptMaterial(parsePromptInput(args));
      return {
        success: true,
        message: `已保存提示词：${prompt.title}`,
        prompt: { id: prompt.id, title: prompt.title, version: prompt.version },
      };
    }) as ToolHandler,
    requiresConfirmation: true,
  });

  toolRegistry.register({
    name: 'prompt_update',
    description: '使用当前版本号更新已有团队共享提示词；必须提交完整正文和变量定义。',
    parameters: createToolParameter(
      {
        id: { type: 'string', description: '要更新的提示词 ID' },
        expected_version: {
          type: 'integer',
          minimum: 1,
          description: '读取到的当前版本号',
        },
        ...promptInputProperties(),
      },
      ['id', 'expected_version', 'title', 'body', 'tags', 'variables']
    ),
    handler: (async (args: unknown) => {
      const record = readRecord(args);
      const id = readRequiredText(record.id, '提示词 ID');
      if (
        typeof record.expected_version !== 'number' ||
        !Number.isInteger(record.expected_version)
      ) {
        throw new Error('expected_version 必须是整数');
      }
      const prompt = await updatePromptMaterial(
        id,
        parsePromptInput(record),
        record.expected_version
      );
      return {
        success: true,
        message: `已更新提示词：${prompt.title}`,
        prompt: { id: prompt.id, title: prompt.title, version: prompt.version },
      };
    }) as ToolHandler,
    requiresConfirmation: true,
  });

  toolRegistry.register({
    name: 'prompt_archive',
    description: '归档一个团队共享提示词，使其不再出现在可用列表中。',
    parameters: createToolParameter({ id: { type: 'string', description: '要归档的提示词 ID' } }, [
      'id',
    ]),
    handler: (async (args: unknown) => {
      const id = readRequiredText(readRecord(args).id, '提示词 ID');
      await archivePromptMaterial(id);
      return { success: true, message: '提示词已归档', prompt: { id } };
    }) as ToolHandler,
    requiresConfirmation: true,
  });
}

function promptInputParameter() {
  return createToolParameter(promptInputProperties(), ['title', 'body', 'tags', 'variables']);
}

function promptInputProperties() {
  return {
    title: { type: 'string' as const, description: '提示词标题' },
    body: { type: 'string' as const, description: '提示词正文，使用 {{variable}} 表示变量' },
    summary: { type: 'string' as const, description: '提示词摘要，可选' },
    tags: {
      type: 'array' as const,
      description: '提示词标签，可为空数组',
      items: { type: 'string' as const, description: '一个标签' },
    },
    variables: {
      type: 'array' as const,
      description: '正文中使用的变量定义，可为空数组',
      items: {
        type: 'object' as const,
        description: '提示词变量',
        properties: {
          key: { type: 'string' as const, description: '变量名' },
          label: { type: 'string' as const, description: '变量显示名称' },
          description: { type: 'string' as const, description: '变量说明，可选' },
          required: { type: 'boolean' as const, description: '是否必填' },
          default_value: { type: 'string' as const, description: '默认值，可选' },
          sensitive: { type: 'boolean' as const, description: '是否为敏感输入' },
        },
        required: ['key', 'label', 'required'],
        additionalProperties: false,
      },
    },
  };
}

function parsePromptInput(value: unknown): PromptMaterialInput {
  const record = readRecord(value);
  const variables = readVariables(record.variables);
  return validatePromptMaterialInput({
    title: readRequiredText(record.title, '提示词标题'),
    body: readRequiredText(record.body, '提示词正文'),
    ...(readOptionalText(record.summary) ? { summary: readOptionalText(record.summary) } : {}),
    tags: readStringList(record.tags, '提示词标签'),
    variables,
  });
}

function readVariables(value: unknown): PromptVariable[] {
  if (!Array.isArray(value)) throw new Error('提示词 variables 必须是数组');
  return value.map((entry, index) => {
    const record = readRecord(entry);
    return {
      key: readRequiredText(record.key, `第 ${index + 1} 个变量名`),
      label: readRequiredText(record.label, `第 ${index + 1} 个变量名称`),
      ...(readOptionalText(record.description)
        ? { description: readOptionalText(record.description) }
        : {}),
      required: record.required === true,
      ...(readOptionalText(record.default_value)
        ? { defaultValue: readOptionalText(record.default_value) }
        : {}),
      ...(record.sensitive === true ? { sensitive: true } : {}),
    };
  });
}

function readStringList(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${label}必须是数组`);
  return value.map((entry, index) => readRequiredText(entry, `${label} ${index + 1}`));
}

function readRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('参数必须是对象');
  }
  return value as Record<string, unknown>;
}

function readRequiredText(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label}不能为空`);
  return value;
}

function readOptionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}
