/**
 * Render a Jenkins job path child-first, e.g. `team/demo` -> `demo/team`.
 * Job/folder names cannot contain `/`, so reversing a path is safe.
 */
export function formatJobName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  const parts = (trimmed.includes('»') ? trimmed.split('»') : trimmed.split('/'))
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length <= 1) return trimmed;
  return parts.reverse().join('/');
}

/**
 * Best-effort human-readable job name derived from a Jenkins job/build URL,
 * child-first, e.g. `https://ci/job/team/job/demo` -> `demo/team`.
 */
export function deriveJobNameFromUrl(jobUrl: string): string {
  try {
    const names = new URL(jobUrl).pathname
      .split('/')
      .filter((segment) => segment && segment !== 'job' && segment !== 'view')
      .map((segment) => {
        try {
          return decodeURIComponent(segment);
        } catch {
          return segment;
        }
      });
    return names.length > 0 ? formatJobName(names.join('/')) : jobUrl;
  } catch {
    return jobUrl;
  }
}

/** True when the value is a raw URL rather than a display name. */
export function isUrlLike(value: string | undefined): boolean {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}
