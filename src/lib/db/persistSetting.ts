import { db } from '@/db';
import type { SettingKey, SettingValue } from '@/db/types';
import { trackSettings } from '@/lib/analytics/events';
import { getSetting, updateSetting } from '@/lib/db/settings';

const JENKINS_FLAG_KEYS = new Set<string>([
  'jenkins_workbench_v2',
  'jenkins_queue',
  'jenkins_build_lifecycle',
  'jenkins_full_log',
  'jenkins_pipeline_features',
  'jenkins_artifacts',
  'jenkins_ai_actions',
]);

function reportPersistedSetting(key: string, value: unknown): void {
  if (key === 'auto_sync_enabled') {
    trackSettings(value === true ? 'syncEnabled' : 'syncDisabled');
    return;
  }
  if ((key.startsWith('feature_') && key.endsWith('_enabled')) || JENKINS_FLAG_KEYS.has(key)) {
    trackSettings('featureFlagChanged', { meta: { flag: key } });
  }
}

/**
 * 同步开关 / 功能开关的写入入口。Options 与 AI 工具共用，避免各入口各自埋点。
 * 值未变化时不写库、不上报。多键写入走同一事务，避免部分成功。
 */
export async function persistSettings(
  entries: ReadonlyArray<{ key: string; value: unknown }>
): Promise<void> {
  if (entries.length === 0) return;

  const previousValues = await Promise.all(entries.map(({ key }) => getSetting(key)));

  await db.transaction('rw', db.settings, async () => {
    for (const { key, value } of entries) {
      await updateSetting(key, value);
    }
  });

  entries.forEach(({ key, value }, index) => {
    if (!Object.is(previousValues[index], value)) {
      reportPersistedSetting(key, value);
    }
  });
}

export async function persistSetting<K extends SettingKey>(
  key: K,
  value: SettingValue<K>
): Promise<void>;
export async function persistSetting(key: string, value: unknown): Promise<void>;
export async function persistSetting(key: string, value: unknown): Promise<void> {
  await persistSettings([{ key, value }]);
}
