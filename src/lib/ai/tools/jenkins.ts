// Jenkins management AI tools
import { getJob, listBuilds, listJobs, switchJenkinsEnv, syncJenkins } from '@/lib/db/jenkins';
import { createToolParameter, toolRegistry } from '../tools';
import type { ToolHandler } from '../tools';

/**
 * List all Jenkins jobs, optionally filtered by keyword
 */
async function jenkins_list_jobs(args: { keyword?: string }) {
  return listJobs(args);
}

/**
 * List build history for a job
 */
async function jenkins_list_builds(args: { jobUrl: string; limit?: number }) {
  return listBuilds(args);
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
          type: 'number',
          description: 'Maximum number of builds to return (default: 10)',
        },
      },
      ['jobUrl']
    ),
    handler: jenkins_list_builds as ToolHandler,
  });

  // jenkins_trigger_build (requires confirmation)
  toolRegistry.register({
    name: 'jenkins_trigger_build',
    description: 'Trigger a Jenkins build',
    parameters: createToolParameter(
      {
        jobUrl: { type: 'string', description: 'The job URL to build' },
        parameters: {
          type: 'object',
          description: 'Build parameters (optional)',
        },
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
