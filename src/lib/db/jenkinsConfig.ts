import type { JenkinsCredentials } from './jenkinsConfigShared';
import { resolveJenkinsConfig } from './jenkinsEnvironmentSync';

export type { JenkinsCredentials, ResolvedJenkinsConfig } from './jenkinsConfigShared';
export {
  resolveJenkinsConfig,
  syncCurrentJenkinsEnvironment,
  syncJenkinsCredentials,
} from './jenkinsEnvironmentSync';
export { clearLegacyJenkinsSettings, syncLegacyJenkinsSettings } from './jenkinsLegacyBridge';

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
