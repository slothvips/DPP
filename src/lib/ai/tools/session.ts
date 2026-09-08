import { createToolParameter, toolRegistry } from '@/lib/ai/tools';
import type { ToolHandler } from '@/lib/ai/tools';

async function clearSessionContext() {
  return { action: 'session_context_cleared' as const };
}

async function createNewSession(args: unknown) {
  const record = readRecord(args);
  const title = optionalText(record.title, '会话标题', 30);
  const roleId = optionalText(record.role_id, '角色 ID', 200);
  const roleTitle = optionalText(record.role_title, '角色名称', 100);
  const openingMessage = optionalText(record.opening_message, '开场消息', 4_000);
  if (roleId && roleTitle) throw new Error('角色 ID 和角色名称只能提供一个');
  return {
    action: 'new_session_requested' as const,
    ...(title ? { title } : {}),
    ...(roleId ? { role_id: roleId } : {}),
    ...(roleTitle ? { role_title: roleTitle } : {}),
    ...(openingMessage ? { opening_message: openingMessage } : {}),
  };
}

export function registerSessionTools(): void {
  toolRegistry.register({
    name: 'clear_session_context',
    description: '清空当前会话的消息、计划和网页任务，但不删除会话本身。',
    parameters: createToolParameter({}, []),
    handler: clearSessionContext as ToolHandler,
    requiresConfirmation: true,
  });

  toolRegistry.register({
    name: 'create_new_session',
    description:
      '创建并切换到一个新的 AI 会话，旧会话会完整保留。可指定角色和助手开场白；不要用开场白伪造用户消息。',
    parameters: createToolParameter({
      title: { type: 'string', description: '新会话标题，可选，最长 30 个字符' },
      role_id: { type: 'string', description: '角色 ID，可选；不提供时继承当前角色' },
      role_title: {
        type: 'string',
        description: '角色名称，可选；与角色 ID 只能提供一个，名称必须精确且唯一',
      },
      opening_message: { type: 'string', description: '新会话中的助手开场白，可选' },
    }),
    handler: createNewSession as ToolHandler,
    requiresConfirmation: true,
  });
}

function readRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('会话工具参数必须是对象');
  }
  return value as Record<string, unknown>;
}

function optionalText(value: unknown, label: string, maxLength: number): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label}不能为空`);
  const normalized = value.trim();
  if (normalized.length > maxLength) throw new Error(`${label}最多 ${maxLength} 个字符`);
  return normalized;
}
