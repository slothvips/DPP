export type RecentActionType = 'link_visit' | 'jenkins_build' | 'totp_copy';

export interface RecentAction {
  id: string;
  type: RecentActionType;
  targetId: string;
  label: string;
  jobUrl?: string;
  envId?: string;
  lastUsedAt: number;
}
