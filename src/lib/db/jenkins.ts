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
      getSetting<JenkinsEnvironment[]>('jenkins_environments'),
      getSetting<string>('jenkins_current_env'),
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

    const environments = (await getSetting<JenkinsEnvironment[]>('jenkins_environments')) || [];

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
