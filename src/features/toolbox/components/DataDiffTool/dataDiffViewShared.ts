import { buildTree, isEqual, processDiff } from './dataDiffDiff';
import { MAX_RECORDS, detectChildrenField, detectFields, parseData } from './dataDiffParsing';
import type { DiffItem, ParsedFields, UpdateDetail } from './dataDiffTypes';

export const INITIAL_DATA_A = `[
  { "id": "1", "name": "根节点", "pid": "0" },
  { "id": "2", "name": "子节点A", "pid": "1" },
  { "id": "3", "name": "子节点B", "pid": "1" }
]`;

export const INITIAL_DATA_B = `[
  { "id": "1", "name": "根节点", "pid": "0" },
  { "id": "2", "name": "子节点A-修改", "pid": "1" },
  { "id": "4", "name": "新节点", "pid": "1" }
]`;

export function compareDataSources(dataA: string, dataB: string) {
  if (!dataA.trim() || !dataB.trim()) {
    throw new Error('请填写两组数据');
  }

  const tempA = JSON.parse(dataA);
  const tempB = JSON.parse(dataB);
  const sampleData = Array.isArray(tempA) ? tempA : tempB;
  const parsedSample = Array.isArray(sampleData) ? sampleData : [sampleData];
  const childrenField = detectChildrenField(parsedSample);
  const parsedDataA = parseData(dataA, childrenField);
  const parsedDataB = parseData(dataB, childrenField);
  const totalRecords = parsedDataA.length + parsedDataB.length;

  if (totalRecords > MAX_RECORDS) {
    throw new Error(
      `数据量过大（${totalRecords} 条），可能影响性能。建议控制在 ${MAX_RECORDS} 条以内。`
    );
  }

  const fields = detectFields(parsedDataA.length > 0 ? parsedDataA : parsedDataB);
  const { allData, diffMap, diffResult } = processDiff(parsedDataA, parsedDataB, fields);
  const treeData = buildTree(allData, fields, diffMap);

  return {
    diffResult,
    fields,
    originalDataA: parsedDataA,
    originalDataB: parsedDataB,
    treeData,
  };
}

export function buildUpdateDetails(args: {
  currentFields: ParsedFields | null;
  id: string;
  originalDataA: Record<string, unknown>[];
  originalDataB: Record<string, unknown>[];
}): UpdateDetail[] | null {
  const { currentFields, id, originalDataA, originalDataB } = args;
  if (!currentFields) {
    return null;
  }

  const itemA = originalDataA.find((item) => String(item[currentFields.idField]) === id);
  const itemB = originalDataB.find((item) => String(item[currentFields.idField]) === id);
  if (!itemA || !itemB) {
    return null;
  }

  const allKeys = new Set([...Object.keys(itemA), ...Object.keys(itemB)]);
  const changedFields: UpdateDetail[] = [];

  allKeys.forEach((key) => {
    if (['_id', '_pid', '_sort', '_children', '_diffType', currentFields.idField].includes(key)) {
      return;
    }

    if (!isEqual(itemA[key], itemB[key])) {
      changedFields.push({ key, oldVal: itemA[key], newVal: itemB[key] });
    }
  });

  return changedFields;
}

export function getDiffCounts(diffResult: DiffItem[]) {
  return {
    insertCount: diffResult.filter((item) => item.type === 'insert').length,
    removeCount: diffResult.filter((item) => item.type === 'remove').length,
    updateCount: diffResult.filter((item) => item.type === 'update').length,
  };
}
