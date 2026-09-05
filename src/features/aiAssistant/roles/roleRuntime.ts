import type {
  AISessionRoleSnapshot,
  DecryptedRoleMaterial,
} from '@/features/aiAssistant/materials/testCaseTypes';
import { ensureAIToolsRegistered } from '@/lib/ai';
import { buildPromptStaticSections } from '@/lib/ai/promptShared';
import { toolRegistry } from '@/lib/ai/tools';

export const DEFAULT_AI_ROLE_ID = 'builtin:d-zai';

export interface AIRoleToolOption {
  name: string;
  description: string;
  group: string;
  requiresConfirmation: boolean;
}

const TOOL_GROUPS: Array<{ prefixes: string[]; label: string }> = [
  { prefixes: ['links_', 'tags_'], label: '链接与标签' },
  { prefixes: ['jenkins_'], label: 'Jenkins' },
  { prefixes: ['delegate_', 'page_'], label: '浏览器' },
  { prefixes: ['recorder_'], label: '录制' },
  { prefixes: ['prompt_', 'test_'], label: '物料与测试' },
  { prefixes: ['blackboard_', 'recent_'], label: '工作台' },
  { prefixes: ['ai_config_', 'dpp_config_'], label: '配置' },
  { prefixes: ['manage_plan', 'dpp_search'], label: '通用能力' },
];

function getToolGroup(name: string): string {
  return (
    TOOL_GROUPS.find(({ prefixes }) => prefixes.some((prefix) => name.startsWith(prefix)))?.label ??
    '其他'
  );
}

export function getAvailableRoleTools(): AIRoleToolOption[] {
  ensureAIToolsRegistered();
  return toolRegistry
    .getAll()
    .filter((tool) => tool.exposeToModel !== false)
    .map((tool) => ({
      name: tool.name,
      description: tool.description,
      group: getToolGroup(tool.name),
      requiresConfirmation: tool.requiresConfirmation === true,
    }))
    .sort((left, right) =>
      left.group === right.group
        ? left.name.localeCompare(right.name)
        : left.group.localeCompare(right.group)
    );
}

export function createDefaultRoleSnapshot(): AISessionRoleSnapshot {
  return {
    roleId: DEFAULT_AI_ROLE_ID,
    title: 'D 仔',
    version: 1,
    description: '处理页面、链接、记录和工程任务。',
    systemPrompt: buildPromptStaticSections(),
    allowedToolNames: getAvailableRoleTools().map(({ name }) => name),
  };
}

export function createRoleSnapshot(role: DecryptedRoleMaterial): AISessionRoleSnapshot {
  const availableToolNames = new Set(getAvailableRoleTools().map(({ name }) => name));
  const allowedToolNames =
    role.content.toolPolicy.mode === 'all'
      ? [...availableToolNames]
      : role.content.toolPolicy.toolNames.filter((name) => availableToolNames.has(name));

  return {
    roleId: role.id,
    title: role.title,
    version: role.version,
    ...(role.content.description ? { description: role.content.description } : {}),
    systemPrompt: role.content.systemPrompt,
    allowedToolNames,
  };
}
