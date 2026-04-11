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
        title: '确认触发构建',
        description: '此操作将触发 Jenkins 构建任务，可能需要一些时间完成。',
        impact: `将触发 Jenkins 构建任务: ${args.jobUrl || '未知任务'}`,
        confirmText: '确认构建',
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
