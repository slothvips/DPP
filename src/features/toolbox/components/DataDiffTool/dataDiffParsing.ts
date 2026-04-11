import type { ParsedFields } from './dataDiffTypes';

export const MAX_RECORDS = 10000;

const ID_PATTERNS = ['id', 'menuId', 'key', 'uid', 'code'];
const NAME_PATTERNS = ['name', 'menuName', 'label', 'title', 'text'];
const PID_PATTERNS = ['pid', 'parentId', 'parent_id', 'parent', 'parentKey', 'pId'];
const CHILDREN_PATTERNS = ['children', 'childs', 'nodes', 'items'];
const SORT_PATTERNS = ['sort', 'sortNo', 'sortno', 'order', 'seq', 'index'];

export function detectField(data: unknown[], patterns: string[]): string | null {
  if (!Array.isArray(data) || data.length === 0) return null;

  const checkCount = Math.min(data.length, 5);
  for (let i = 0; i < checkCount; i++) {
    const sample = data[i];
    if (typeof sample !== 'object' || sample === null) continue;

    for (const pattern of patterns) {
      if (pattern in sample) return pattern;
    }
  }

  return null;
}

export function detectFields(data: unknown[]): ParsedFields {
  return {
    idField: detectField(data, ID_PATTERNS) || 'id',
    nameField: detectField(data, NAME_PATTERNS) || 'name',
    pidField: detectField(data, PID_PATTERNS) || 'pid',
    childrenField: detectField(data, CHILDREN_PATTERNS) || 'children',
    sortField: detectField(data, SORT_PATTERNS) || 'sortNo',
  };
}

export function detectChildrenField(sampleData: unknown[]): string {
  return detectField(sampleData, CHILDREN_PATTERNS) || 'children';
}

export function isTreeData(data: unknown, childrenField: string): boolean {
  if (!Array.isArray(data) || data.length === 0) return false;

  return (data as Record<string, unknown>[]).some(
    (item) => item[childrenField] && Array.isArray(item[childrenField])
  );
}

export function flattenTreeData(
  treeData: Record<string, unknown>[],
  childrenField: string
): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = [];

  function traverse(nodes: Record<string, unknown>[]) {
    nodes.forEach((node) => {
      const children = node[childrenField] as Record<string, unknown>[];
      const nodeData = { ...node };
      delete nodeData[childrenField];
      result.push(nodeData);

      if (children && Array.isArray(children) && children.length > 0) {
        traverse(children);
      }
    });
  }

  traverse(treeData);
  return result;
}

export function parseData(jsonText: string, childrenField: string): Record<string, unknown>[] {
  const parsed = JSON.parse(jsonText);
  if (!Array.isArray(parsed)) {
    return [parsed] as Record<string, unknown>[];
  }

  if (isTreeData(parsed, childrenField)) {
    return flattenTreeData(parsed, childrenField);
  }

  return parsed;
}
