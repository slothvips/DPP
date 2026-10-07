import {
  getNotifyBotToken,
  getNotifyConfig,
  listActiveNotifyTargets,
  listNotifyTargets,
  writeNotifyState,
} from '@/lib/db/notify';
import { JENKINS_BUILD_SCOPE } from './canonical.ts';
import { type NotifyDraft, saveNotifyConfigWith } from './saveCore.ts';
import { type NotifyTestDraft, sendNotifyTest } from './sendTest.ts';
import { sendTelegramNotification } from './telegram.ts';
import { hasNotifyTeamSync, notifyWorkerRequest } from './workerApi.ts';

async function createJenkinsBuildSince(targetId: string): Promise<void> {
  const response = await notifyWorkerRequest('/api/notify/since', {
    json: { scope: JENKINS_BUILD_SCOPE, targetId, create: true },
  });
  await response.text();
  if (!response.ok) throw new Error('起始时间保存失败');
}

export function sendSavedNotifyTest(draft: NotifyTestDraft): Promise<number> {
  return sendNotifyTest(draft, {
    loadToken: getNotifyBotToken,
    loadTemplate: async () => (await getNotifyConfig())?.messageTemplate ?? '',
    loadTargets: async () => {
      const rows = await listActiveNotifyTargets();
      return rows.map(({ id, kind, label, chatId }) => ({ id, kind, label, chatId }));
    },
    send: sendTelegramNotification,
  });
}

export async function saveNotifyConfig(draft: NotifyDraft): Promise<void> {
  await saveNotifyConfigWith(draft, {
    hasTeamSync: hasNotifyTeamSync,
    loadTargets: listNotifyTargets,
    createSince: createJenkinsBuildSince,
    write: writeNotifyState,
  });
}
