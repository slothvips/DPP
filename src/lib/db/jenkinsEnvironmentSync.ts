import type { JenkinsEnvironment } from '@/db';
import { getSetting, updateSetting } from '@/lib/db/settings';
import {
  type JenkinsCredentials,
  type ResolvedJenkinsConfig,
  toEnvironmentCredentials,
} from './jenkinsConfigShared';
import { getLegacyJenkinsCredentials, syncLegacyJenkinsSettings } from './jenkinsLegacyBridge';

export async function resolveJenkinsConfig(targetEnvId?: string): Promise<ResolvedJenkinsConfig> {
  const [environments = [], currentEnvId = '', legacyCredentials] = await Promise.all([
    getSetting('jenkins_environments'),
    getSetting('jenkins_current_env'),
    getLegacyJenkinsCredentials(),
  ]);

  const targetEnv =
    (targetEnvId ? environments.find((env) => env.id === targetEnvId) : undefined) ??
    (currentEnvId ? environments.find((env) => env.id === currentEnvId) : undefined);

  if (targetEnv) {
    return {
      credentials: toEnvironmentCredentials(targetEnv),
      environments,
      currentEnvId,
    };
  }

  return {
    credentials: legacyCredentials,
    environments,
    currentEnvId,
  };
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

  const targetIndex = findTargetEnvironmentIndex(environments, currentEnvId, args);
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

function findTargetEnvironmentIndex(
  environments: JenkinsEnvironment[],
  currentEnvId: string | undefined,
  args: Pick<JenkinsCredentials, 'host' | 'user' | 'token'>
): number {
  if (currentEnvId) {
    const currentMatchIndex = environments.findIndex(
      (env) => env.id === currentEnvId && env.host === args.host
    );
    if (currentMatchIndex !== -1) {
      return currentMatchIndex;
    }
  }

  const exactMatchIndex = environments.findIndex(
    (env) => env.host === args.host && env.user === args.user
  );
  if (exactMatchIndex !== -1) {
    return exactMatchIndex;
  }

  return environments.findIndex((env) => env.host === args.host);
}
