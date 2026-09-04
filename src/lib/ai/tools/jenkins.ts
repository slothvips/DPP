// Jenkins management AI tools
import { getBuildDetails } from '@/features/jenkins/api/buildDetails';
import {
  getJenkinsCredentials,
  getJob,
  listBuilds,
  listJobs,
  switchJenkinsEnv,
  syncJenkins,
} from '@/lib/db/jenkins';
import { createToolParameter, toolRegistry } from '../tools';
import type { ToolHandler } from '../tools';

/**
 * List all Jenkins jobs, optionally filtered by keyword
 */
async function jenkins_list_jobs(args: { keyword?: string; page?: number; pageSize?: number }) {
  return listJobs(args);
}

/**
 * List build history for a job
 */
async function jenkins_list_builds(args: { jobUrl: string; limit?: number; offset?: number }) {
  return listBuilds(args);
}

async function jenkins_get_build_details(args: {
  buildUrl: string;
  envId?: string;
  consoleTailLines?: number;
}) {
  const { host, user, token } = await getJenkinsCredentials(args.envId);
  return getBuildDetails(
    args.buildUrl,
    user,
    token,
    host,
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
  const result = await switchJenkinsEnv(args);
  if (result.success) {
    return result;
  } else {
    throw new Error(result.message);
  }
}

/**
 * Register all Jenkins tools
 */
export function registerJenkinsTools() {
  // jenkins_list_jobs
  toolRegistry.register({
    name: 'jenkins_list_jobs',
    description: 'List all Jenkins jobs, supports keyword filtering',
    parameters: createToolParameter(
      {
        keyword: {
          type: 'string',
          description: 'Keyword to filter jobs by name, fullName, or URL',
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
    description: 'Get build history for a specific Jenkins job',
    parameters: createToolParameter(
      {
        jobUrl: { type: 'string', description: 'The job URL' },
        limit: {
          type: 'integer',
          minimum: 1,
          description: 'Maximum number of builds to return (default: 10)',
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
    description:
      'Open the Jenkins build configuration dialog; the build does not start until the user confirms it in the dialog',
    parameters: createToolParameter(
      {
        jobUrl: { type: 'string', description: 'The job URL to build' },
      },
      ['jobUrl']
    ),
    handler: jenkins_trigger_build as ToolHandler,
    requiresConfirmation: true,
  });

  // jenkins_sync (requires confirmation)
  toolRegistry.register({
    name: 'jenkins_sync',
    description: 'Sync Jenkins jobs and builds data',
    parameters: createToolParameter(
      {
        envId: {
          type: 'string',
          description:
            'Environment ID to sync (optional, uses current environment if not provided)',
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
    description: 'Switch to a different Jenkins environment',
    parameters: createToolParameter(
      {
        envId: { type: 'string', description: 'The environment ID to switch to' },
      },
      ['envId']
    ),
    handler: jenkins_switchEnv as ToolHandler,
    requiresConfirmation: true,
  });
}
