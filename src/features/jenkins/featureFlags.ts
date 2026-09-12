import { getSetting } from '@/lib/db/settings';

export const JENKINS_FEATURE_KEYS = {
  workbench: 'jenkins_workbench_v2',
  queue: 'jenkins_queue',
  buildLifecycle: 'jenkins_build_lifecycle',
  fullLog: 'jenkins_full_log',
  pipeline: 'jenkins_pipeline_features',
  artifacts: 'jenkins_artifacts',
  aiActions: 'jenkins_ai_actions',
} as const;

export type JenkinsFeatureKey = keyof typeof JENKINS_FEATURE_KEYS;
export type JenkinsFeatureToggles = Record<JenkinsFeatureKey, boolean>;

export const DEFAULT_JENKINS_FEATURE_TOGGLES: JenkinsFeatureToggles = {
  workbench: true,
  queue: true,
  buildLifecycle: true,
  fullLog: true,
  pipeline: true,
  artifacts: true,
  aiActions: true,
};

export const JENKINS_FEATURE_LABELS: Record<JenkinsFeatureKey, string> = {
  workbench: '新版工作台',
  queue: '队列',
  buildLifecycle: '构建生命周期',
  fullLog: '完整日志',
  pipeline: 'Pipeline 能力',
  artifacts: '构建产物',
  aiActions: 'AI 操作',
};

export function resolveJenkinsFeatureToggles(
  settings: Array<{ key: string; value: unknown }>
): JenkinsFeatureToggles {
  return Object.fromEntries(
    Object.entries(JENKINS_FEATURE_KEYS).map(([feature, key]) => [
      feature,
      settings.find((setting) => setting.key === key)?.value !== false,
    ])
  ) as JenkinsFeatureToggles;
}

export async function isJenkinsFeatureEnabled(feature: JenkinsFeatureKey): Promise<boolean> {
  return (await getSetting(JENKINS_FEATURE_KEYS[feature])) !== false;
}

export async function requireJenkinsFeature(feature: JenkinsFeatureKey): Promise<void> {
  if (!(await isJenkinsFeatureEnabled(feature))) {
    throw new Error(`Jenkins 能力已关闭：${feature}`);
  }
}
