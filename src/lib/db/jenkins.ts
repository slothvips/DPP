import { type JenkinsEnvironment, db } from '@/db';
import { fetchAllJobs } from '@/features/jenkins/api/fetchJobs';
import { fetchMyBuilds } from '@/features/jenkins/api/fetchMyBuilds';

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
    const settings = await db.settings.toArray();
    const environments =
      (settings.find((s) => s.key === 'jenkins_environments')?.value as JenkinsEnvironment[]) || [];

    // 确定要使用的环境 ID
    const targetEnvId =
      args.envId || (settings.find((s) => s.key === 'jenkins_current_env')?.value as string);

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

    const settings = await db.settings.toArray();
    const environments =
      (settings.find((s) => s.key === 'jenkins_environments')?.value as JenkinsEnvironment[]) || [];

    // 验证环境是否存在
    const env = environments.find((e) => e.id === envId);

    if (!env) {
      return {
        success: false,
        message: `找不到指定的 Jenkins 环境: ${envId}`,
      };
    }

    // 更新当前环境
    await db.settings.put({ key: 'jenkins_current_env', value: envId });

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
