export interface BlackboardItem {
  id: string; // UUID
  content: string; // Markdown text
  createdAt: number;
  updatedAt: number;
  pinned?: boolean; // Pinned to top
}
