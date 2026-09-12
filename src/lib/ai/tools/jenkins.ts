// Jenkins management AI tools
import { getJenkinsDiagnostics } from '@/features/jenkins/diagnostics';
import { requireJenkinsFeature } from '@/features/jenkins/featureFlags';
import { JenkinsService } from '@/features/jenkins/service';
import { getJob, listJobs, switchJenkinsEnv, syncJenkins } from '@/lib/db/jenkins';
import { createToolParameter, toolRegistry } from '../tools';
import type { ToolHandler } from '../tools';

/**
 * List all Jenkins jobs, optionally filtered by keyword
 */
async function jenkins_list_jobs(args: { keyword?: string; page?: number; pageSize?: number }) {
  await requireJenkinsFeature('aiActions');
  return listJobs(args);
}

/**
 * List build history for a job
 */
async function jenkins_list_builds(args: { jobUrl: string; limit?: number; offset?: number }) {
  await requireJenkinsFeature('aiActions');
  const offset = Math.max(0, args.offset ?? 0);
  const limit = Math.min(Math.max(1, args.limit ?? 20), 100);
  const result = await JenkinsService.fetchJobBuilds(
    args.jobUrl,
    undefined,
    Math.min(offset + limit, 100)
  );
  return {
    job: result.job,
    builds: result.builds.slice(offset, offset + limit),
    total: result.total,
  };
}

async function jenkins_get_build_details(args: {
  buildUrl: string;
  envId?: string;
  consoleTailLines?: number;
}) {
  await requireJenkinsFeature('aiActions');
  return JenkinsService.getBuildDetails(
    args.buildUrl,
    args.envId,
    Math.min(Math.max(0, args.consoleTailLines ?? 100), 200)
  );
}

/**
 * Trigger a Jenkins build - returns build info for UI to open BuildDialog
 */
async function jenkins_trigger_build(args: {
  jobUrl: string;
  parameters?: Record<string, string>;
}) {
  await requireJenkinsFeature('aiActions');
  // Verify job exists
  const job = await getJob(args);
  if (!job) {
    throw new Error(`Job not found: ${args.jobUrl}`);
  }

  // Return build info for UI to open BuildDialog
  // The actual build will be triggered by BuildDialog
  return {
    success: true,
    action: 'open_build_dialog',
    jobUrl: args.jobUrl,
    jobName: job.fullName || job.name,
    message: `请在弹出的构建对话框中配置参数并确认构建 ${job.fullName || job.name}`,
  };
}

/**
 * Sync Jenkins data (jobs and builds)
 */
async function jenkins_sync(args: { envId?: string }) {
  await requireJenkinsFeature('aiActions');
  const result = await syncJenkins(args);
  if (result.success) {
    return result;
  } else {
    throw new Error(result.message);
  }
}

/**
 * Switch Jenkins environment
 */
async function jenkins_switchEnv(args: { envId: string }) {
  await requireJenkinsFeature('aiActions');
  const result = await switchJenkinsEnv(args);
  if (result.success) {
    return result;
  } else {
    throw new Error(result.message);
  }
}

/**
 * Read the local, redacted Jenkins connection and capability diagnostics.
 */
async function jenkins_get_status(args: { envId?: string }) {
  await requireJenkinsFeature('aiActions');
  return getJenkinsDiagnostics(args.envId);
}

/**
 * Read a queued Jenkins item, including its blocking reason.
 */
async function jenkins_get_queue_item(args: { queueId: string; envId?: string }) {
  await requireJenkinsFeature('aiActions');
  return JenkinsService.getQueueItem(args.queueId, args.envId);
}

/**
 * Cancel a queued Jenkins item. Requires explicit confirmation.
 */
async function jenkins_cancel_queue(args: { queueId: string; envId?: string }) {
  await requireJenkinsFeature('aiActions');
  await JenkinsService.cancelQueueItem(args.queueId, args.envId);
  return { success: true, queueId: args.queueId, message: `已取消队列项 ${args.queueId}` };
}

/**
 * Stop a running Jenkins build. Requires explicit confirmation.
 */
async function jenkins_stop_build(args: { buildUrl: string; envId?: string }) {
  await requireJenkinsFeature('aiActions');
  await JenkinsService.stopBuild(args.buildUrl, args.envId);
  return { success: true, buildUrl: args.buildUrl, message: '已请求停止运行中的构建' };
}

/**
 * Approve or abort a pending Pipeline input. Requires explicit confirmation.
 */
async function jenkins_submit_pipeline_input(args: {
  buildUrl: string;
  inputId: string;
  decision: 'proceed' | 'abort';
  envId?: string;
}) {
  await requireJenkinsFeature('aiActions');
  await JenkinsService.submitPipelineInput(args.buildUrl, args.inputId, args.decision, args.envId);
  return {
    success: true,
    inputId: args.inputId,
    decision: args.decision,
    message: args.decision === 'proceed' ? '已批准 Pipeline 输入' : '已中止 Pipeline 输入',
  };
}

/**
 * Register all Jenkins tools
 */
export function registerJenkinsTools() {
  // jenkins_list_jobs
  toolRegistry.register({
    name: 'jenkins_list_jobs',
    description: '列出所有 Jenkins 任务，支持按关键词筛选',
    parameters: createToolParameter(
      {
        keyword: {
          type: 'string',
          description: '按任务名称、fullName 或 URL 筛选任务的关键词',
        },
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
    handler: jenkins_list_jobs as ToolHandler,
  });

  // jenkins_list_builds
  toolRegistry.register({
    name: 'jenkins_list_builds',
    description: '获取指定 Jenkins 任务的构建历史',
    parameters: createToolParameter(
      {
        jobUrl: { type: 'string', description: '任务 URL' },
        limit: {
          type: 'integer',
          minimum: 1,
          description: '最多返回的构建数量，默认 10',
        },
        offset: { type: 'integer', minimum: 0, description: '跳过的构建数量，默认 0' },
      },
      ['jobUrl']
    ),
    handler: jenkins_list_builds as ToolHandler,
  });

  toolRegistry.register({
    name: 'jenkins_get_build_details',
    description:
      '读取一个 Jenkins 构建的状态、参数、变更、产物、测试统计和脱敏后的控制台日志尾部。先用 jenkins_list_builds 获取 buildUrl。',
    parameters: createToolParameter(
      {
        buildUrl: { type: 'string', description: 'Jenkins 构建 URL' },
        envId: { type: 'string', description: 'Jenkins 环境 ID，不提供时使用当前环境' },
        consoleTailLines: {
          type: 'integer',
          minimum: 0,
          maximum: 200,
          description: '控制台日志尾部行数，默认 100；设为 0 不读取日志',
        },
      },
      ['buildUrl']
    ),
    handler: jenkins_get_build_details as ToolHandler,
  });

  // jenkins_trigger_build (requires confirmation)
  toolRegistry.register({
    name: 'jenkins_trigger_build',
    description: '打开 Jenkins 构建配置对话框；用户在对话框中确认前不会启动构建',
    parameters: createToolParameter(
      {
        jobUrl: { type: 'string', description: '要构建的任务 URL' },
      },
      ['jobUrl']
    ),
    handler: jenkins_trigger_build as ToolHandler,
    requiresConfirmation: true,
  });

  // jenkins_sync (requires confirmation)
  toolRegistry.register({
    name: 'jenkins_sync',
    description: '同步 Jenkins 任务和构建数据',
    parameters: createToolParameter(
      {
        envId: {
          type: 'string',
          description: '要同步的环境 ID，可选；不提供时使用当前环境',
        },
      },
      []
    ),
    handler: jenkins_sync as ToolHandler,
    requiresConfirmation: true,
  });

  // jenkins_switchEnv
  toolRegistry.register({
    name: 'jenkins_switchEnv',
    description: '切换到其他 Jenkins 环境',
    parameters: createToolParameter(
      {
        envId: { type: 'string', description: '要切换到的环境 ID' },
      },
      ['envId']
    ),
    handler: jenkins_switchEnv as ToolHandler,
    requiresConfirmation: true,
  });

  // jenkins_get_status (read-only, redacted diagnostics)
  toolRegistry.register({
    name: 'jenkins_get_status',
    description:
      '读取本地 Jenkins 同步状态、stale 标记、错误分类、Pipeline 能力快照和请求/缓存/队列/日志指标。用于诊断认证、CSRF、队列超时、插件缺失和缓存过期。',
    parameters: createToolParameter(
      {
        envId: { type: 'string', description: 'Jenkins 环境 ID，不提供时使用当前环境' },
      },
      []
    ),
    handler: jenkins_get_status as ToolHandler,
  });

  // jenkins_get_queue_item (read-only)
  toolRegistry.register({
    name: 'jenkins_get_queue_item',
    description: '读取指定 Jenkins 队列项的状态和阻塞原因',
    parameters: createToolParameter(
      {
        queueId: { type: 'string', description: 'Jenkins 队列 ID' },
        envId: { type: 'string', description: 'Jenkins 环境 ID，不提供时使用当前环境' },
      },
      ['queueId']
    ),
    handler: jenkins_get_queue_item as ToolHandler,
  });

  // jenkins_cancel_queue (always confirmed)
  toolRegistry.register({
    name: 'jenkins_cancel_queue',
    description: '取消一个排队中的 Jenkins 构建；需要用户显式确认，YOLO 模式也不能绕过。',
    parameters: createToolParameter(
      {
        queueId: { type: 'string', description: '要取消的 Jenkins 队列 ID' },
        envId: { type: 'string', description: 'Jenkins 环境 ID，不提供时使用当前环境' },
      },
      ['queueId']
    ),
    handler: jenkins_cancel_queue as ToolHandler,
    requiresConfirmation: true,
  });

  // jenkins_stop_build (always confirmed)
  toolRegistry.register({
    name: 'jenkins_stop_build',
    description: '停止一个运行中的 Jenkins 构建；需要用户显式确认，YOLO 模式也不能绕过。',
    parameters: createToolParameter(
      {
        buildUrl: { type: 'string', description: '要停止的 Jenkins 构建 URL' },
        envId: { type: 'string', description: 'Jenkins 环境 ID，不提供时使用当前环境' },
      },
      ['buildUrl']
    ),
    handler: jenkins_stop_build as ToolHandler,
    requiresConfirmation: true,
  });

  // jenkins_submit_pipeline_input (always confirmed)
  toolRegistry.register({
    name: 'jenkins_submit_pipeline_input',
    description:
      '批准或中止一个挂起的 Pipeline 人工审批输入；需要用户显式确认，YOLO 模式也不能绕过。',
    parameters: createToolParameter(
      {
        buildUrl: { type: 'string', description: 'Pipeline 构建 URL' },
        inputId: { type: 'string', description: 'Pipeline 挂起输入的 ID' },
        decision: {
          type: 'string',
          enum: ['proceed', 'abort'],
          description: 'proceed 表示批准，abort 表示中止',
        },
        envId: { type: 'string', description: 'Jenkins 环境 ID，不提供时使用当前环境' },
      },
      ['buildUrl', 'inputId', 'decision']
    ),
    handler: jenkins_submit_pipeline_input as ToolHandler,
    requiresConfirmation: true,
  });
}
