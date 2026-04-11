import type { BuildTreeFields, DiffFields, DiffInfo, DiffItem, TreeNode } from './dataDiffTypes';

const MAX_COMPARE_DEPTH = 20;

export function isEqual(obj1: unknown, obj2: unknown, depth = 0): boolean {
  if (obj1 === obj2) return true;
  if (Number.isNaN(obj1) && Number.isNaN(obj2)) return true;
  if (obj1 == null || obj2 == null) return obj1 === obj2;
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return obj1 === obj2;

  if (depth >= MAX_COMPARE_DEPTH) {
    return JSON.stringify(obj1) === JSON.stringify(obj2);
  }

  if (Array.isArray(obj1) && Array.isArray(obj2)) {
    if (obj1.length !== obj2.length) return false;
    return obj1.every((item, index) => isEqual(item, obj2[index], depth + 1));
  }

  if (Array.isArray(obj1) !== Array.isArray(obj2)) return false;

  const keys1 = Object.keys(obj1 as object);
  const keys2 = Object.keys(obj2 as object);
  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (!keys2.includes(key)) return false;
    if (
      !isEqual(
        (obj1 as Record<string, unknown>)[key],
        (obj2 as Record<string, unknown>)[key],
        depth + 1
      )
    ) {
      return false;
    }
  }

  return true;
}

export function computeDiff(
  dataA: Record<string, unknown>[],
  dataB: Record<string, unknown>[],
  fields: DiffFields
): DiffItem[] {
  const diffResult: DiffItem[] = [];
  const mapA = new Map<string, Record<string, unknown>>();
  const mapB = new Map<string, Record<string, unknown>>();

  dataA.forEach((item) => mapA.set(String(item[fields.idField]), item));
  dataB.forEach((item) => mapB.set(String(item[fields.idField]), item));

  dataB.forEach((itemB) => {
    const itemA = mapA.get(String(itemB[fields.idField]));
    if (!itemA) {
      diffResult.push({ ...itemB, type: 'insert' });
    } else if (!isEqual(itemA, itemB)) {
      diffResult.push({ ...itemB, type: 'update' });
    }
  });

  dataA.forEach((itemA) => {
    if (!mapB.has(String(itemA[fields.idField]))) {
      diffResult.push({ ...itemA, type: 'remove' });
    }
  });

  return diffResult;
}

export function processDiff(
  dataA: Record<string, unknown>[],
  dataB: Record<string, unknown>[],
  fields: DiffFields
) {
  const diffResult = computeDiff(dataA, dataB, fields);
  const diffMap = new Map<string, string>();
  diffResult.forEach((item) => diffMap.set(String(item[fields.idField]), item.type));

  const dataBIds = new Set(dataB.map((item) => String(item[fields.idField])));
  const allData = [...dataB];
  dataA.forEach((item) => {
    if (!dataBIds.has(String(item[fields.idField]))) {
      allData.push(item);
    }
  });

  return { allData, diffMap, diffResult };
}

export function buildTree(
  data: Record<string, unknown>[],
  fields: BuildTreeFields,
  diffMap: Map<string, string>
): TreeNode[] {
  const nodeMap = new Map<string, TreeNode>();
  const rootNodes: TreeNode[] = [];

  data.forEach((item) => {
    const nodeId = String(item[fields.idField]);
    const pidValue = item[fields.pidField];
    const pid = pidValue != null ? String(pidValue) : 'root';

    nodeMap.set(nodeId, {
      ...item,
      _id: nodeId,
      _pid: pid,
      _sort: parseInt(String(item[fields.sortField] ?? 0), 10) || 0,
      _children: [],
      _diffType: diffMap.get(nodeId) || null,
    });
  });

  data.forEach((item) => {
    const nodeId = String(item[fields.idField]);
    const node = nodeMap.get(nodeId)!;
    const pidValue = item[fields.pidField];
    const pid = pidValue != null ? String(pidValue) : 'root';

    if (pid === 'root' || !nodeMap.has(pid)) {
      rootNodes.push(node);
    } else {
      nodeMap.get(pid)!._children.push(node);
    }
  });

  const visitingSet = new Set<string>();
  const sortChildren = (node: TreeNode) => {
    if (visitingSet.has(node._id)) return;
    visitingSet.add(node._id);

    if (node._children.length > 0) {
      node._children.sort((a, b) => (a._sort || 0) - (b._sort || 0));
      node._children.forEach(sortChildren);
    }

    visitingSet.delete(node._id);
  };

  rootNodes.sort((a, b) => (a._sort || 0) - (b._sort || 0));
  rootNodes.forEach(sortChildren);
  return rootNodes;
}

export function nodeHasDiff(node: TreeNode): boolean {
  return Boolean(node._diffType) || node._children.some(nodeHasDiff);
}

export function getDiffInfo(type: string | null): DiffInfo | null {
  if (!type) return null;

  switch (type) {
    case 'insert':
      return {
        label: '新增',
        bg: 'bg-success/10',
        border: 'border-success/20',
        textColor: 'text-success',
      };
    case 'remove':
      return {
        label: '删除',
        bg: 'bg-destructive/10',
        border: 'border-destructive/20',
        textColor: 'text-destructive',
      };
    case 'update':
      return {
        label: '更新',
        bg: 'bg-primary/10',
        border: 'border-primary/20',
        textColor: 'text-primary',
      };
    default:
      return null;
  }
}

export function formatValue(value: unknown): string {
  if (value == null) return 'null';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
