import type { NotifySubscriptions } from '@/db/typesDomain';
import { canonicalHttpUrl } from './canonical.ts';

/** 旧对象没有这段配置时，继续接收全部 Jenkins Job。 */
export function subscribesToJenkinsJob(
  subscriptions: NotifySubscriptions | undefined,
  jobUrl: string
): boolean {
  const jenkins = subscriptions?.jenkins;
  if (!jenkins) return true;
  if (!jenkins.enabled) return false;
  if (!jenkins.jobs) return true;
  const canonical = canonicalHttpUrl(jobUrl);
  if (!canonical) return false;
  return jenkins.jobs.some((url) => canonicalHttpUrl(url) === canonical);
}

/** 完全不会收到 Jenkins 通知的对象（显式关闭，或 Job 清单为空数组）。 */
export function receivesNoJenkinsNotifications(
  subscriptions: NotifySubscriptions | undefined
): boolean {
  const jenkins = subscriptions?.jenkins;
  if (!jenkins) return false;
  if (!jenkins.enabled) return true;
  return jenkins.jobs !== undefined && jenkins.jobs.length === 0;
}

export function normalizeNotifySubscriptions(
  value: NotifySubscriptions | undefined
): NotifySubscriptions | undefined {
  if (!value?.jenkins) return value;
  const jobs =
    value.jenkins.jobs === undefined
      ? undefined
      : [
          ...new Set(
            value.jenkins.jobs.flatMap((url) => {
              const canonical = canonicalHttpUrl(url);
              return canonical ? [canonical] : [];
            })
          ),
        ];
  return {
    jenkins: {
      enabled: value.jenkins.enabled,
      ...(jobs === undefined ? {} : { jobs }),
    },
  };
}
