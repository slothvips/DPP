import type { LinkTagItem } from '@/db/types';

export interface LinkMutationResult {
  success: boolean;
  message: string;
}

export interface AddLinkArgs {
  name: string;
  url: string;
  note?: string;
  tags?: string[];
}

export interface UpdateLinkArgs {
  id: string;
  name?: string;
  url?: string;
  note?: string;
  tags?: string[];
}

export interface DeleteLinkArgs {
  id: string;
}

export interface BulkAddLinksArgs {
  links: AddLinkArgs[];
}

export interface ResolvedLinkInput {
  name: string;
  url: string;
  note?: string;
  tags: string[];
}

export interface LinkTagChanges {
  toAdd: LinkTagItem[];
  toUpdate: LinkTagItem[];
  toDelete: Array<[string, string]>;
}
