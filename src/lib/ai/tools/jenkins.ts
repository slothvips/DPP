// Jenkins management AI tools
import { db } from '@/db';
import { JenkinsService } from '@/features/jenkins/service';
import { createToolParameter, toolRegistry } from '../tools';
import type { ToolHandler } from '../tools';

/**
 * List all Jenkins jobs, optionally filtered by keyword
 */
async function jenkins_list_jobs(args: { keyword?: string }) {
  let jobs = await db.jobs.toArray();

  // Filter by keyword
  if (args.keyword) {
    const keyword = args.keyword.toLowerCase();
    jobs = jobs.filter(
      (j) =>
        j.name.toLowerCase().includes(keyword) ||
        (j.fullName && j.fullName.toLowerCase().includes(keyword)) ||
        (j.url && j.url.toLowerCase().includes(keyword))
    );
  }

  return {
    total: jobs.length,
    jobs: jobs.map((j) => ({
      name: j.name,
      url: j.url,
      color: j.color,
      type: j.type,
      fullName: j.fullName,
      lastStatus: j.lastStatus,
      lastBuildTime: j.lastBuildTime,
      lastBuildUrl: j.lastBuildUrl,
      env: j.env,
    })),
  };
}

/**
 * List build history for a job
 */
async function jenkins_list_builds(args: { jobUrl: string; limit?: number }) {
  // Get the job first
  const job = await db.jobs.get(args.jobUrl);
  if (!job) {
    throw new Error(`Job not found: ${args.jobUrl}`);
  }

  // Get builds from myBuilds table
  let builds = await db.myBuilds
    .filter((b) => b.jobUrl === args.jobUrl)
    .reverse()
    .sortBy('timestamp');

  // Apply limit
  if (args.limit) {
    builds = builds.slice(0, args.limit);
  }

  return {
    job: {
      name: job.name,
      url: job.url,
      lastStatus: job.lastStatus,
    },
    builds: builds.map((b) => ({
      id: b.id,
      number: b.number,
      result: b.result,
      timestamp: b.timestamp,
      duration: b.duration,
      building: b.building,
      userName: b.userName,
    })),
    total: builds.length,
  };
}

/**
 * Trigger a Jenkins build
 */
async function jenkins_trigger_build(args: {
  jobUrl: string;
  parameters?: Record<string, string>;
}) {
  // Verify job exists
  const job = await db.jobs.get(args.jobUrl);
  if (!job) {
    throw new Error(`Job not found: ${args.jobUrl}`);
  }

  const result = await JenkinsService.triggerBuild(args.jobUrl, args.parameters);

  if (result) {
    return {
      success: true,
      message: `Build triggered successfully for ${job.name}`,
      jobUrl: args.jobUrl,
    };
  } else {
    throw new Error(`Failed to trigger build for ${job.name}`);
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
}
