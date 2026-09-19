export interface ToolConfirmationContent {
  title: string;
  description: string;
  impact: string;
  confirmText: string;
  isDestructive: boolean;
}

function truncateConfirmationValue(value: string, maxLength = 120): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
}

export function getToolConfirmationContent(
  toolName: string,
  args: Record<string, unknown>
): ToolConfirmationContent {
  switch (toolName) {
    case 'clear_session_context':
      return {
        title: '确认清空会话',
        description: '此操作将停止当前任务，并删除当前会话的消息、计划和网页任务。',
        impact: '当前会话将保留，但上下文无法恢复',
        confirmText: '确认清空',
        isDestructive: true,
      };
    case 'create_new_session':
      return {
        title: '确认创建新会话',
        description: '此操作将保留当前会话，并创建和切换到一个新会话。',
        impact: `角色: ${args.role_title || args.role_id || '继承当前角色'}；标题: ${args.title || '新会话'}`,
        confirmText: '创建会话',
        isDestructive: false,
      };
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
    case 'jenkins_cancel_queue':
      return {
        title: '确认取消排队构建',
        description: '此操作将取消指定的 Jenkins 排队项，取消后需要重新触发。',
        impact: `将取消队列项: ${args.queueId || '未知队列'}`,
        confirmText: '确认取消',
        isDestructive: true,
      };
    case 'jenkins_stop_build':
      return {
        title: '确认停止构建',
        description: '此操作将请求停止正在运行的 Jenkins 构建。',
        impact: `将停止构建: ${args.buildUrl || '未知构建'}`,
        confirmText: '确认停止',
        isDestructive: true,
      };
    case 'jenkins_submit_pipeline_input':
      return {
        title: '确认提交 Pipeline 审批',
        description: '此操作将批准或中止一个挂起的 Pipeline 人工审批输入。',
        impact: `将对输入 ${args.inputId || '未知输入'} 执行 ${
          args.decision === 'abort' ? '中止' : '批准'
        }`,
        confirmText: args.decision === 'abort' ? '确认中止' : '确认批准',
        isDestructive: args.decision === 'abort',
      };
    case 'recorder_start':
      return {
        title: '确认开始录制',
        description: '此操作将开始录屏，可能会占用系统资源。',
        impact: '将在当前标签页开始录制',
        confirmText: '开始录制',
        isDestructive: false,
      };
    case 'delegate_browser_agent':
      return {
        title: '确认委派网页任务',
        description: '网页子 Agent 将只处理以下边界明确的任务；同一标签页的任务会排队。',
        impact:
          typeof args.tab_id === 'number'
            ? `复用标签页: ${args.tab_id}；任务: ${typeof args.task === 'string' ? args.task : '未提供'}`
            : `新建任务标签页: ${typeof args.initial_url === 'string' ? args.initial_url : '未提供 URL'}；任务: ${typeof args.task === 'string' ? args.task : '未提供'}`,
        confirmText: '委派任务',
        isDestructive: false,
      };
    case 'ai_config_update': {
      const changes: string[] = [];
      if (args.provider) changes.push(`服务商: ${String(args.provider)}`);
      if (args.baseUrl) changes.push(`baseUrl: ${String(args.baseUrl)}`);
      if (args.model) changes.push(`模型: ${String(args.model)}`);
      if (typeof args.apiKey === 'string' && args.apiKey) changes.push('API Key: 将更新');
      if (args.activateProvider === false) changes.push('不激活该服务商');
      return {
        title: '确认修改 AI 配置',
        description:
          '此操作会修改 AI 服务商、模型或密钥配置。请核对 baseUrl 是否为预期的服务商地址。',
        impact: changes.length > 0 ? `将更新：${changes.join('；')}` : '将更新服务商: 当前服务商',
        confirmText: '确认修改',
        isDestructive: false,
      };
    }
    case 'dpp_config_update': {
      const updates = (args.updates as Record<string, unknown>) || {};
      const entries = Object.entries(updates).map(
        ([key, value]) =>
          `${key} = ${truncateConfirmationValue(typeof value === 'string' ? value : JSON.stringify(value))}`
      );
      return {
        title: '确认修改 DPP 配置',
        description: '此操作会修改 DPP 本地设置，可能影响功能显示、同步、Jenkins 或通知行为。',
        impact: entries.length > 0 ? `将更新配置：${entries.join('；')}` : '将更新配置: 未知配置',
        confirmText: '确认修改',
        isDestructive: false,
      };
    }
    case 'test_case_import': {
      const testCases = Array.isArray(args.test_cases) ? args.test_cases : [];
      return {
        title: '确认导入测试用例',
        description: '以下测试用例已完成静态审查；确认后将写入团队共享测试用例库。',
        impact: `将导入 ${testCases.length} 条测试用例`,
        confirmText: '确认导入',
        isDestructive: false,
      };
    }
    case 'test_case_update':
      return {
        title: '确认更新测试用例',
        description: '此操作会覆盖团队共享测试用例的当前版本。',
        impact: `将更新测试用例 ID: ${args.id || '未知'}`,
        confirmText: '确认更新',
        isDestructive: false,
      };
    case 'test_case_delete':
      return {
        title: '确认删除测试用例',
        description: '此操作会从团队共享库中移除测试用例，但不会删除历史执行记录，且无法恢复。',
        impact: `将删除测试用例 ID: ${args.id || '未知'}`,
        confirmText: '确认删除',
        isDestructive: true,
      };
    case 'test_project_execute':
      return {
        title: '确认执行测试项目',
        description:
          '将按顺序执行项目中全部已启用测试用例，单条失败、阻塞或技术错误不会中断后续用例。',
        impact: `将执行测试项目 ID: ${args.project_id || '未知'}`,
        confirmText: '执行项目',
        isDestructive: false,
      };
    case 'test_run_execute':
      return {
        title: '确认执行测试用例',
        description: '将按步骤顺序操作目标网页，并保存测试报告。',
        impact: `将执行测试用例 ID: ${args.test_case_id || '未知'}`,
        confirmText: '执行测试',
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
