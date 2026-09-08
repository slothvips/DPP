import type {
  AISessionRoleSnapshot,
  DecryptedRoleMaterial,
} from '@/features/aiAssistant/materials/testCaseTypes';
import { ensureAIToolsRegistered } from '@/lib/ai';
import { buildPromptStaticSections } from '@/lib/ai/promptShared';
import { toolRegistry } from '@/lib/ai/tools';

export const DEFAULT_AI_ROLE_ID = 'builtin:d-zai';
export const BASIC_AI_TOOL_NAMES: readonly string[] = [
  'date_time',
  'calculate',
  'convert_units',
  'developer_utility',
];

export interface AIRoleToolOption {
  name: string;
  description: string;
  group: string;
  requiresConfirmation: boolean;
}

const TOOL_GROUPS: Array<{ prefixes: string[]; label: string }> = [
  {
    prefixes: [
      ...BASIC_AI_TOOL_NAMES,
      'manage_plan',
      'dpp_search',
      'get_recent_activities',
      'clear_session_context',
      'create_new_session',
    ],
    label: '通用',
  },
  { prefixes: ['delegate_', 'list_browser_', 'page_'], label: '浏览器' },
  { prefixes: ['links_'], label: '链接' },
  { prefixes: ['tags_'], label: '标签' },
  { prefixes: ['blackboard_'], label: '黑板' },
  { prefixes: ['jenkins_'], label: 'Jenkins' },
  { prefixes: ['hotnews_'], label: '热点资讯' },
  { prefixes: ['recorder_'], label: '录制' },
  { prefixes: ['prompt_'], label: '提示词' },
  { prefixes: ['test_'], label: '测试' },
  { prefixes: ['ai_config_', 'dpp_config_', 'sync_'], label: '配置与同步' },
];

function getToolGroup(name: string): string {
  return (
    TOOL_GROUPS.find(({ prefixes }) => prefixes.some((prefix) => name.startsWith(prefix)))?.label ??
    '其他'
  );
}

function getToolGroupOrder(group: string): number {
  const index = TOOL_GROUPS.findIndex(({ label }) => label === group);
  return index === -1 ? TOOL_GROUPS.length : index;
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
    .sort((left, right) => getToolGroupOrder(left.group) - getToolGroupOrder(right.group));
}

export function createDefaultRoleSnapshot(): AISessionRoleSnapshot {
  return {
    roleId: DEFAULT_AI_ROLE_ID,
    title: 'D 仔',
    version: 1,
    description: 'DPP 的默认 AI 助手。',
    systemPrompt: buildPromptStaticSections(),
    allowedToolNames: getAvailableRoleTools().map(({ name }) => name),
  };
}

export function createBuiltInRoleSnapshot(roleId: string): AISessionRoleSnapshot | undefined {
  if (roleId === DEFAULT_AI_ROLE_ID) return createDefaultRoleSnapshot();
  return undefined;
}

export function isDppBuiltInRole(roleId: string): boolean {
  return roleId === DEFAULT_AI_ROLE_ID;
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
