export interface BlackboardItem {
  id: string; // UUID
  content: string; // Markdown text
  createdAt: number;
  updatedAt: number;
  pinned?: boolean; // Pinned to top
  locked?: boolean; // Locked to prevent accidental editing
  deletedAt?: number; // Soft delete timestamp
}
