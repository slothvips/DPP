import { DurableObject } from 'cloudflare:workers';
import { D1SyncStore, type PushResult, type SyncOperation } from './d1';

export type SyncCoordinatorEnv = Pick<Env, 'DB'>;

export class SyncPushCoordinator extends DurableObject<SyncCoordinatorEnv> {
  async push(operations: SyncOperation[], clientId?: string): Promise<PushResult> {
    let result: PushResult | undefined;
    await this.ctx.blockConcurrencyWhile(async () => {
      result = await new D1SyncStore(this.env.DB).push(operations, clientId);
    });
    if (!result) throw new Error('Sync push did not produce a result');
    return result;
  }
}
