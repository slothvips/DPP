import type { JenkinsEnvironment } from '@/db';

export interface JenkinsCredentials {
  host: string;
  user: string;
  token: string;
  envId: string;
}

export interface ResolvedJenkinsConfig {
  credentials: JenkinsCredentials | null;
  environments: JenkinsEnvironment[];
  currentEnvId: string;
}

export function toEnvironmentCredentials(env: JenkinsEnvironment): JenkinsCredentials {
  return {
    host: env.host,
    user: env.user,
    token: env.token,
    envId: env.id,
  };
}
