/** 软删除判定：undefined / null 视为未删除 */
export function isSoftDeleted(item: { deletedAt?: number | null }): boolean {
  return item.deletedAt != null;
}
