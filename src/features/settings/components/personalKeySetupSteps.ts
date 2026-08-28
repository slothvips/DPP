import type { PersonalKeyFinalizeStep } from '@/lib/sync/personalSyncBootstrap';

export type PersonalKeySetupStepId = 'saving' | PersonalKeyFinalizeStep;

export type PersonalKeySetupPhase = PersonalKeySetupStepId | 'done' | 'error';

export interface PersonalKeySetupProgressState {
  phase: PersonalKeySetupPhase;
  /** 出错时所在步骤，用于进度条定位 */
  failedStep?: PersonalKeySetupStepId;
  /** 同步成功时记录条数 */
  enqueued?: number;
  errorMessage?: string;
}

export const PERSONAL_KEY_SETUP_STEPS: Array<{
  id: PersonalKeySetupStepId;
  label: string;
}> = [
  { id: 'saving', label: '保存个人私钥' },
  { id: 'enqueue', label: '准备个人数据' },
  { id: 'sync', label: '同步个人数据' },
];

const STEP_ORDER: PersonalKeySetupStepId[] = ['saving', 'enqueue', 'sync'];

export function getPersonalKeySetupStepIndex(state: PersonalKeySetupProgressState): number {
  if (state.phase === 'done') {
    return STEP_ORDER.length;
  }
  if (state.phase === 'error') {
    return state.failedStep ? STEP_ORDER.indexOf(state.failedStep) : 0;
  }
  return STEP_ORDER.indexOf(state.phase);
}

export function getPersonalKeySetupStatusText(state: PersonalKeySetupProgressState): string {
  switch (state.phase) {
    case 'saving':
      return '正在保存个人私钥…';
    case 'enqueue':
      return '正在准备个人数据上传…';
    case 'sync':
      return '正在上传并拉取个人数据…';
    case 'done':
      return state.enqueued && state.enqueued > 0
        ? `已完成：准备并同步 ${state.enqueued} 条个人数据`
        : '已完成：个人数据已同步';
    case 'error':
      return state.errorMessage ?? '个人私钥已保存，但后续同步失败。请检查同步配置后手动同步。';
  }
}
