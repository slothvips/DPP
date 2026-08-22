export interface ToolConfirmationContent {
  title: string;
  description: string;
  impact: string;
  confirmText: string;
  isDestructive: boolean;
}

export function getToolConfirmationContent(
  toolName: string,
  args: Record<string, unknown>
): ToolConfirmationContent {
  switch (toolName) {
    case 'links_delete':
      return {
        title: '确认删除链接',
        description: '此操作将删除指定的链接，且无法恢复。',
        impact: `将删除链接 ID: ${args.id || '未知'}`,
        confirmText: '确认删除',
        isDestructive: true,
      };
    case 'blackboard_delete':
      return {
        title: '确认删除便签',
        description: '此操作将删除指定的便签，且无法恢复。',
        impact: `将删除便签 ID: ${args.id || '未知'}`,
        confirmText: '确认删除',
        isDestructive: true,
      };
    case 'tags_delete':
      return {
        title: '确认删除标签',
        description: '此操作将删除指定的标签及其所有关联关系，且无法恢复。',
        impact: `将删除标签 ID: ${args.id || '未知'}`,
        confirmText: '确认删除',
        isDestructive: true,
      };
    case 'jenkins_trigger_build':
      return {
        title: '确认打开构建配置',
        description: '此操作将打开 Jenkins 构建配置对话框，构建仍需您在对话框中确认后才会开始。',
        impact: `将打开 Jenkins 构建配置: ${args.jobUrl || '未知任务'}`,
        confirmText: '打开配置',
        isDestructive: false,
      };
    case 'recorder_start':
      return {
        title: '确认开始录制',
        description: '此操作将开始录屏，可能会占用系统资源。',
        impact: '将在当前标签页开始录制',
        confirmText: '开始录制',
        isDestructive: false,
      };
    case 'ai_config_update':
      return {
        title: '确认修改 D仔 配置',
        description: '此操作会修改 D仔 的 AI 服务商、模型或密钥配置。',
        impact: `将更新服务商: ${args.provider || '当前服务商'}`,
        confirmText: '确认修改',
        isDestructive: false,
      };
    case 'dpp_config_update':
      return {
        title: '确认修改 DPP 配置',
        description: '此操作会修改 DPP 本地设置，可能影响功能显示、同步、Jenkins 或通知行为。',
        impact: `将更新配置: ${Object.keys((args.updates as Record<string, unknown>) || {}).join(', ') || '未知配置'}`,
        confirmText: '确认修改',
        isDestructive: false,
      };
    default:
      return {
        title: '确认操作',
        description: '此操作需要您的确认才能继续执行。',
        impact: `将执行: ${toolName}`,
        confirmText: '确认',
        isDestructive: false,
      };
  }
}
