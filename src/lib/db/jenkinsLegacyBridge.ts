import { getSetting, updateSetting } from '@/lib/db/settings';
import type { JenkinsCredentials } from './jenkinsConfigShared';

export async function getLegacyJenkinsCredentials(): Promise<JenkinsCredentials | null> {
  const [legacyHost, legacyUser, legacyToken] = await Promise.all([
    getSetting('jenkins_host'),
    getSetting('jenkins_user'),
    getSetting('jenkins_token'),
  ]);

  if (!legacyHost || !legacyUser || !legacyToken) {
    return null;
  }

  return {
    host: legacyHost,
    user: legacyUser,
    token: legacyToken,
    envId: 'default',
  };
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
