export const TASK_GROUP_TITLE_PREFIX = 'DPP · ';

export function toTaskGroupTitle(name: string): string {
  return `${TASK_GROUP_TITLE_PREFIX}${name.replace(/\s+/g, ' ').trim().slice(0, 32) || '网页任务'}`;
}

export function isTaskGroupTitle(title: string | undefined): boolean {
  return typeof title === 'string' && title.startsWith(TASK_GROUP_TITLE_PREFIX);
}
