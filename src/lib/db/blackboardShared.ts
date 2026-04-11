import { db } from '@/db';

export interface BlackboardListItem {
  id: string;
  content: string;
  pinned: boolean;
  locked: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface BlackboardListResult {
  total: number;
  items: BlackboardListItem[];
}

export interface BlackboardMutationResult {
  success: boolean;
  message: string;
}

export interface AddBlackboardResult extends BlackboardMutationResult {
  id: string;
}

export interface AddBlackboardArgs {
  content: string;
  pinned?: boolean;
}

export interface UpdateBlackboardArgs {
  id: string;
  content?: string;
  pinned?: boolean;
  locked?: boolean;
}

export interface DeleteBlackboardArgs {
  id: string;
}

export interface ToggleBlackboardArgs {
  id: string;
}

export function getBlackboardTable() {
  return db.blackboard;
}

export function mapBlackboardListItem(item: {
  id: string;
  content: string;
  pinned?: boolean;
  locked?: boolean;
  createdAt: number;
  updatedAt: number;
}): BlackboardListItem {
  return {
    id: item.id,
    content: item.content,
    pinned: item.pinned || false,
    locked: item.locked || false,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export async function getBlackboardItemOrThrow(id: string) {
  const item = await getBlackboardTable().get(id);
  if (!item) {
    throw new Error('便签不存在或已被删除');
  }

  return item;
}
