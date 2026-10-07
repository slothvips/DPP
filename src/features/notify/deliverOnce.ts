import { syncEngine } from '@/db';
import { getNotifyBotToken, listNotifyTargets } from '@/lib/db/notify';
import { type DeliverOnceInput, deliverOnce as runDeliverOnce } from './deliverCore.ts';
import { sendTelegramNotification } from './telegram.ts';
import { notifyWorkerRequest } from './workerApi.ts';

export async function deliverOnce(input: DeliverOnceInput) {
  return runDeliverOnce(input, {
    loadToken: getNotifyBotToken,
    loadTargets: listNotifyTargets,
    async getClientId() {
      const clientId = await syncEngine.getClientId();
      if (!clientId) throw new Error('缺少客户端 id');
      return clientId;
    },
    async request(path, body) {
      const response = await notifyWorkerRequest(path, { json: body });
      let parsed: unknown = null;
      try {
        parsed = await response.json();
      } catch {
        parsed = null;
      }
      return { status: response.status, body: parsed };
    },
    sendTelegram: sendTelegramNotification,
  });
}
