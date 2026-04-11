import type { JobItem, MyBuildItem, OthersBuildItem } from '@/db';
import { db } from '@/db';
import { fetchAllJobs } from '@/features/jenkins/api/fetchJobs';
import { fetchMyBuilds } from '@/features/jenkins/api/fetchMyBuilds';
import { getSetting, updateSetting } from '@/lib/db/settings';

export async function saveJobs(jobs: JobItem[]): Promise<void> {
  if (jobs.length > 0) {
    await db.jobs.bulkPut(jobs);
  }
}

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

    const targetEnvId = args.envId || currentEnvId;

    if (!targetEnvId) {
      return {
        success: false,
        message: '未设置当前 Jenkins 环境',
      };
    }

    const env = environments.find((environment) => environment.id === targetEnvId);

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

    const [jobsCount, buildsCount] = await Promise.all([
      fetchAllJobs(host, user, token, targetEnvId),
      fetchMyBuilds(host, user, token, targetEnvId),
    ]);

    return {
      success: true,
      message: `同步成功: ${jobsCount} 个 Jobs, ${buildsCount} 个 Builds`,
      syncedCount: jobsCount + buildsCount,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `同步失败: ${errorMessage}`,
    };
  }
}

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
    const env = environments.find((environment) => environment.id === envId);

    if (!env) {
      return {
        success: false,
        message: `找不到指定的 Jenkins 环境: ${envId}`,
      };
    }

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

export async function deleteJenkinsEnv(envId: string): Promise<void> {
  await db.transaction('rw', db.jobs, db.myBuilds, db.othersBuilds, async () => {
    await Promise.all([
      db.jobs.where('env').equals(envId).delete(),
      db.myBuilds.where('env').equals(envId).delete(),
      db.othersBuilds.where('env').equals(envId).delete(),
    ]);
  });
}
