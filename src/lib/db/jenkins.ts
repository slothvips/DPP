import {
  type JenkinsEnvironment,
  type JobItem,
  type MyBuildItem,
  type OthersBuildItem,
  db,
} from '@/db';
import { fetchAllJobs } from '@/features/jenkins/api/fetchJobs';
import { fetchMyBuilds } from '@/features/jenkins/api/fetchMyBuilds';
import { getSetting, updateSetting } from '@/lib/db/settings';

export interface JenkinsCredentials {
  host: string;
  user: string;
  token: string;
  envId: string;
}

interface ResolvedJenkinsConfig {
  credentials: JenkinsCredentials | null;
  environments: JenkinsEnvironment[];
  currentEnvId: string;
}

export async function resolveJenkinsConfig(targetEnvId?: string): Promise<ResolvedJenkinsConfig> {
  const [environments = [], currentEnvId = '', legacyHost, legacyUser, legacyToken] =
    await Promise.all([
      getSetting('jenkins_environments'),
      getSetting('jenkins_current_env'),
      getSetting('jenkins_host'),
      getSetting('jenkins_user'),
      getSetting('jenkins_token'),
    ]);

  const targetEnv =
    (targetEnvId ? environments.find((env) => env.id === targetEnvId) : undefined) ??
    (currentEnvId ? environments.find((env) => env.id === currentEnvId) : undefined);

  if (targetEnv) {
    return {
      credentials: {
        host: targetEnv.host,
        user: targetEnv.user,
        token: targetEnv.token,
        envId: targetEnv.id,
      },
      environments,
      currentEnvId,
    };
  }

  if (legacyHost && legacyUser && legacyToken) {
    return {
      credentials: {
        host: legacyHost,
        user: legacyUser,
        token: legacyToken,
        envId: 'default',
      },
      environments,
      currentEnvId,
    };
  }

  return {
    credentials: null,
    environments,
    currentEnvId,
  };
}

export async function getJenkinsCredentials(targetEnvId?: string): Promise<JenkinsCredentials> {
  const { credentials, environments } = await resolveJenkinsConfig(targetEnvId);

  if (credentials) {
    return credentials;
  }

  if (targetEnvId && environments.length > 0) {
    throw new Error(`Jenkins environment not found: ${targetEnvId}`);
  }

  throw new Error('Jenkins credentials not configured');
}

export async function syncLegacyJenkinsSettings(args: {
  host: string;
  user: string;
  token: string;
}): Promise<void> {
  const [currentHost, currentUser, currentToken] = await Promise.all([
    getSetting('jenkins_host'),
    getSetting('jenkins_user'),
    getSetting('jenkins_token'),
  ]);

  const updates: Promise<void>[] = [];

  if (currentHost !== args.host) {
    updates.push(updateSetting('jenkins_host', args.host));
  }

  if (currentUser !== args.user) {
    updates.push(updateSetting('jenkins_user', args.user));
  }

  if (currentToken !== args.token) {
    updates.push(updateSetting('jenkins_token', args.token));
  }

  await Promise.all(updates);
}

export async function clearLegacyJenkinsSettings(): Promise<void> {
  const updates: Promise<void>[] = [];

  if ((await getSetting('jenkins_host')) !== undefined) {
    updates.push(updateSetting('jenkins_host', ''));
  }

  if ((await getSetting('jenkins_user')) !== undefined) {
    updates.push(updateSetting('jenkins_user', ''));
  }

  if ((await getSetting('jenkins_token')) !== undefined) {
    updates.push(updateSetting('jenkins_token', ''));
  }

  await Promise.all(updates);
}

export async function syncCurrentJenkinsEnvironment(args: {
  host: string;
  user: string;
  token: string;
}): Promise<void> {
  const [environments = [], currentEnvId] = await Promise.all([
    getSetting('jenkins_environments'),
    getSetting('jenkins_current_env'),
  ]);

  if (environments.length === 0) {
    return;
  }

  let targetIndex = -1;

  if (currentEnvId) {
    targetIndex = environments.findIndex(
      (env) => env.id === currentEnvId && env.host === args.host
    );
  }

  if (targetIndex === -1) {
    targetIndex = environments.findIndex((env) => env.host === args.host && env.user === args.user);
  }

  if (targetIndex === -1) {
    targetIndex = environments.findIndex((env) => env.host === args.host);
  }

  if (targetIndex === -1) {
    return;
  }

  const targetEnv = environments[targetIndex];
  if (
    targetEnv.host === args.host &&
    targetEnv.user === args.user &&
    targetEnv.token === args.token
  ) {
    return;
  }

  const updatedEnvironments = [...environments];
  updatedEnvironments[targetIndex] = {
    ...targetEnv,
    host: args.host,
    user: args.user,
    token: args.token,
  };

  await updateSetting('jenkins_environments', updatedEnvironments);
}

export async function syncJenkinsCredentials(args: {
  host: string;
  user: string;
  token: string;
}): Promise<void> {
  await Promise.all([syncCurrentJenkinsEnvironment(args), syncLegacyJenkinsSettings(args)]);
}

/**
 * 保存 Jenkins 任务
 * @param jobs - 任务列表
 */
export async function saveJobs(jobs: JobItem[]): Promise<void> {
  if (jobs.length > 0) {
    await db.jobs.bulkPut(jobs);
  }
}

/**
 * 保存 Jenkins 构建
 * @param envId - 环境 ID
 * @param myBuilds - 我的构建列表
 * @param othersBuilds - 其他人的构建列表
 */
export async function saveBuilds(
  envId: string,
  myBuilds: MyBuildItem[],
  othersBuilds: OthersBuildItem[]
): Promise<void> {
  await db.transaction('rw', db.myBuilds, db.othersBuilds, async () => {
    await db.myBuilds.where('env').equals(envId).delete();
    await db.myBuilds.bulkPut(myBuilds);

    await db.othersBuilds.where('env').equals(envId).delete();
    await db.othersBuilds.bulkPut(othersBuilds);
  });
}

/**
 * 同步 Jenkins 数据
 * @param args.envId - 可选的环境 ID，如果不提供则使用当前选中的环境
 * @returns 同步结果
 */
export async function syncJenkins(args: { envId?: string }): Promise<{
  success: boolean;
  message: string;
  syncedCount?: number;
}> {
  try {
    const [environments = [], currentEnvId] = await Promise.all([
      getSetting('jenkins_environments'),
      getSetting('jenkins_current_env'),
    ]);

    // 确定要使用的环境 ID
    const targetEnvId = args.envId || currentEnvId;

    if (!targetEnvId) {
      return {
        success: false,
        message: '未设置当前 Jenkins 环境',
      };
    }

    // 查找环境配置
    const env = environments.find((e) => e.id === targetEnvId);

    if (!env) {
      return {
        success: false,
        message: `找不到指定的 Jenkins 环境: ${targetEnvId}`,
      };
    }

    const { host, user, token } = env;

    if (!host || !user || !token) {
      return {
        success: false,
        message: `Jenkins 环境 ${targetEnvId} 缺少必要的配置信息`,
      };
    }

    // 执行同步
    const [jobsCount, buildsCount] = await Promise.all([
      fetchAllJobs(host, user, token, targetEnvId),
      fetchMyBuilds(host, user, token, targetEnvId),
    ]);

    const totalSynced = jobsCount + buildsCount;

    return {
      success: true,
      message: `同步成功: ${jobsCount} 个 Jobs, ${buildsCount} 个 Builds`,
      syncedCount: totalSynced,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `同步失败: ${errorMessage}`,
    };
  }
}

/**
 * 切换 Jenkins 环境
 * @param args.envId - 要切换到的环境 ID
 * @returns 切换结果
 */
export async function switchJenkinsEnv(args: { envId: string }): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const { envId } = args;

    if (!envId) {
      return {
        success: false,
        message: '环境 ID 不能为空',
      };
    }

    const environments = (await getSetting('jenkins_environments')) || [];

    // 验证环境是否存在
    const env = environments.find((e) => e.id === envId);

    if (!env) {
      return {
        success: false,
        message: `找不到指定的 Jenkins 环境: ${envId}`,
      };
    }

    // 更新当前环境
    await updateSetting('jenkins_current_env', envId);

    return {
      success: true,
      message: `已切换到 Jenkins 环境: ${env.name || envId}`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `切换环境失败: ${errorMessage}`,
    };
  }
}

/**
 * 删除 Jenkins 环境及其关联的构建历史和任务
 * @param envId - 要删除的环境 ID
 */
export async function deleteJenkinsEnv(envId: string): Promise<void> {
  await db.transaction('rw', db.jobs, db.myBuilds, db.othersBuilds, async () => {
    await Promise.all([
      db.jobs.where('env').equals(envId).delete(),
      db.myBuilds.where('env').equals(envId).delete(),
      db.othersBuilds.where('env').equals(envId).delete(),
    ]);
  });
}

/**
 * List all Jenkins jobs, optionally filtered by keyword
 */
export async function listJobs(args: { keyword?: string }): Promise<{
  total: number;
  jobs: Array<{
    name: string;
    url: string;
    color: string;
    type: string;
    fullName?: string;
    lastStatus?: string;
    lastBuildTime?: number;
    lastBuildUrl?: string;
    env: string;
  }>;
}> {
  let jobs = await db.jobs.toArray();

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
      color: j.color || '',
      type: j.type || '',
      fullName: j.fullName,
      lastStatus: j.lastStatus,
      lastBuildTime: j.lastBuildTime,
      lastBuildUrl: j.lastBuildUrl,
      env: j.env || '',
    })),
  };
}

/**
 * Get all jobs
 */
export async function getAllJobs(): Promise<JobItem[]> {
  return db.jobs.toArray();
}

/**
 * Get a job by URL
 */
export async function getJob(args: { jobUrl: string }): Promise<JobItem | undefined> {
  return db.jobs.get(args.jobUrl);
}

/**
 * List build history for a job
 */
export async function listBuilds(args: { jobUrl: string; limit?: number }): Promise<{
  job: { name: string; url: string; lastStatus?: string };
  builds: Array<{
    id: string;
    number: number;
    result?: string;
    timestamp: number;
    duration: number;
    building: boolean;
    userName?: string;
  }>;
  total: number;
}> {
  const job = await db.jobs.get(args.jobUrl);
  if (!job) {
    throw new Error(`Job not found: ${args.jobUrl}`);
  }

  let builds = await db.myBuilds
    .filter((b) => b.jobUrl === args.jobUrl)
    .reverse()
    .sortBy('timestamp');

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
      duration: b.duration || 0,
      building: b.building,
      userName: b.userName,
    })),
    total: builds.length,
  };
}
