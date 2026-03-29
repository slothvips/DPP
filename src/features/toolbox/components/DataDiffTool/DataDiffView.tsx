import { ChevronLeft } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

// ========== 字段自动检测 ==========

const ID_PATTERNS = ['id', 'menuId', 'key', 'uid', 'code'];
const NAME_PATTERNS = ['name', 'menuName', 'label', 'title', 'text'];
const PID_PATTERNS = ['pid', 'parentId', 'parent_id', 'parent', 'parentKey', 'pId'];
const CHILDREN_PATTERNS = ['children', 'childs', 'nodes', 'items'];
const SORT_PATTERNS = ['sort', 'sortNo', 'sortno', 'order', 'seq', 'index'];

function detectField(data: unknown[], patterns: string[]): string | null {
  if (!data || !Array.isArray(data) || data.length === 0) return null;

  // 检查前N个元素，找到第一个匹配的模式
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

function detectFields(data: unknown[]) {
  return {
    idField: detectField(data, ID_PATTERNS) || 'id',
    nameField: detectField(data, NAME_PATTERNS) || 'name',
    pidField: detectField(data, PID_PATTERNS) || 'pid',
    childrenField: detectField(data, CHILDREN_PATTERNS) || 'children',
    sortField: detectField(data, SORT_PATTERNS) || 'sortNo',
  };
}

// ========== 数据格式转换 ==========

function isTreeData(data: unknown, childrenField: string): boolean {
  if (!Array.isArray(data) || data.length === 0) return false;
  return (data as Record<string, unknown>[]).some(
    (item) => item[childrenField] && Array.isArray(item[childrenField])
  );
}

function flattenTreeData(
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

function parseData(jsonText: string, childrenField: string): Record<string, unknown>[] {
  const parsed = JSON.parse(jsonText);
  if (!Array.isArray(parsed)) {
    // 非数组数据转为单元素数组
    return [parsed] as Record<string, unknown>[];
  }
  if (isTreeData(parsed, childrenField)) {
    return flattenTreeData(parsed, childrenField);
  }
  return parsed;
}

// ========== 差异对比 ==========

function isKeyFieldChanged(
  itemA: Record<string, unknown>,
  itemB: Record<string, unknown>,
  fields: { nameField: string; pidField: string; childrenField: string }
): boolean {
  const { nameField, pidField, childrenField } = fields;
  const keyFields = [nameField, pidField, childrenField];

  for (const key of keyFields) {
    if (!isEqual(itemA[key], itemB[key])) {
      return true;
    }
  }
  return false;
}

// 检测任意字段是否有变化（用于判断 update 类型）
function hasAnyChange(itemA: Record<string, unknown>, itemB: Record<string, unknown>): boolean {
  return !isEqual(itemA, itemB);
}

function isEqual(obj1: unknown, obj2: unknown): boolean {
  if (obj1 === obj2) return true;
  // 处理 NaN 的情况：NaN === NaN 应该返回 true
  if (Number.isNaN(obj1) && Number.isNaN(obj2)) return true;
  if (obj1 == null || obj2 == null) return obj1 === obj2;
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return obj1 === obj2;

  const keys1 = Object.keys(obj1 as object);
  const keys2 = Object.keys(obj2 as object);

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (!keys2.includes(key)) return false;
    if (!isEqual((obj1 as Record<string, unknown>)[key], (obj2 as Record<string, unknown>)[key]))
      return false;
  }

  return true;
}

interface DiffItem extends Record<string, unknown> {
  type: 'insert' | 'remove' | 'update';
}

function computeDiff(
  dataA: Record<string, unknown>[],
  dataB: Record<string, unknown>[],
  fields: { idField: string; nameField: string; pidField: string; childrenField: string }
): DiffItem[] {
  const { idField, nameField, pidField, childrenField } = fields;
  const keyFields = { nameField, pidField, childrenField };
  const diffResult: DiffItem[] = [];

  const mapA = new Map<string, Record<string, unknown>>();
  dataA.forEach((item) => mapA.set(String(item[idField]), item));

  const mapB = new Map<string, Record<string, unknown>>();
  dataB.forEach((item) => mapB.set(String(item[idField]), item));

  dataB.forEach((itemB) => {
    const itemA = mapA.get(String(itemB[idField]));
    if (!itemA) {
      diffResult.push({ ...itemB, type: 'insert' });
    } else if (isKeyFieldChanged(itemA, itemB, keyFields) || hasAnyChange(itemA, itemB)) {
      diffResult.push({ ...itemB, type: 'update' });
    }
  });

  dataA.forEach((itemA) => {
    if (!mapB.has(String(itemA[idField]))) {
      diffResult.push({ ...itemA, type: 'remove' });
    }
  });

  return diffResult;
}

function processDiff(
  dataA: Record<string, unknown>[],
  dataB: Record<string, unknown>[],
  fields: { idField: string; nameField: string; pidField: string; childrenField: string }
) {
  const { idField } = fields;
  const diffResult = computeDiff(dataA, dataB, fields);

  const diffMap = new Map<string, string>();
  diffResult.forEach((item) => diffMap.set(String(item[idField]), item.type));

  const dataBIds = new Set(dataB.map((m) => String(m[idField])));
  const allData = [...dataB];
  dataA.forEach((item) => {
    if (!dataBIds.has(String(item[idField]))) {
      allData.push(item);
    }
  });

  return { diffResult, diffMap, allData };
}

// ========== 树构建 ==========

interface TreeNode extends Record<string, unknown> {
  _id: string;
  _pid: string;
  _sort: number;
  _children: TreeNode[];
  _diffType: string | null;
}

function buildTree(
  data: Record<string, unknown>[],
  fields: { idField: string; pidField: string; sortField: string },
  diffMap: Map<string, string>
): TreeNode[] {
  const { idField, pidField, sortField } = fields;

  const nodeMap = new Map<string, TreeNode>();
  const rootNodes: TreeNode[] = [];

  data.forEach((item) => {
    const nodeId = String(item[idField]);
    const node: TreeNode = {
      ...item,
      _id: nodeId,
      _pid: String(item[pidField] ?? 'root'),
      _sort: parseInt(String(item[sortField] ?? 0), 10) || 0,
      _children: [],
      _diffType: diffMap.get(nodeId) || null,
    };
    nodeMap.set(nodeId, node);
  });

  data.forEach((item) => {
    const nodeId = String(item[idField]);
    const node = nodeMap.get(nodeId)!;
    const pid = String(item[pidField] ?? 'root');

    if (pid === 'root' || !nodeMap.has(pid)) {
      rootNodes.push(node);
    } else {
      nodeMap.get(pid)!._children.push(node);
    }
  });

  const visitingSet = new Set<string>();

  function sortChildren(node: TreeNode) {
    // 检测环形引用，防止无限递归
    if (visitingSet.has(node._id)) return;
    visitingSet.add(node._id);

    if (node._children.length > 0) {
      node._children.sort((a, b) => (a._sort || 0) - (b._sort || 0));
      node._children.forEach((child: TreeNode) => sortChildren(child));
    }

    visitingSet.delete(node._id);
  }

  rootNodes.sort((a, b) => (a._sort || 0) - (b._sort || 0));
  rootNodes.forEach(sortChildren);

  return rootNodes;
}

// ========== 渲染 ==========

interface DiffInfo {
  label: string;
  bg: string;
  border: string;
  textColor: string;
}

function getDiffInfo(type: string | null): DiffInfo | null {
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

interface TreeNodeProps {
  node: TreeNode;
  level: number;
  fields: { idField: string; nameField: string };
  onUpdateClick: (id: string) => void;
  showDiffOnly?: boolean;
}

// 检查节点及其子节点是否包含差异
function nodeHasDiff(node: TreeNode): boolean {
  if (node._diffType) return true;
  return node._children.some(nodeHasDiff);
}

function TreeNodeComponent({ node, level, fields, onUpdateClick, showDiffOnly }: TreeNodeProps) {
  const { idField, nameField } = fields;
  const indent = level * 20;
  const hasChildren = node._children.length > 0;
  const diffInfo = getDiffInfo(node._diffType);
  const hasAnyDiff = nodeHasDiff(node);

  // 如果开启仅显示差异，且节点没有差异，则不渲染
  if (showDiffOnly && !hasAnyDiff) {
    return null;
  }

  const diffBadge = diffInfo ? (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${diffInfo.bg} ${diffInfo.textColor} ${diffInfo.border}`}
    >
      {diffInfo.label}
    </span>
  ) : null;

  const name = (node[nameField] as string) || (node[idField] as string) || '(无名称)';
  const id = node[idField] as string;

  const otherFields = Object.entries(node)
    .filter(
      ([k, v]) =>
        !['_id', '_pid', '_sort', '_children', '_diffType', idField, nameField].includes(k) &&
        v != null
    )
    .slice(0, 3)
    .map(([k, v]) => (
      <span key={k} className="text-muted-foreground">
        {k}: {String(v).slice(0, 20)}
      </span>
    ));

  const isUpdate = diffInfo?.label === '更新';
  const borderClass = diffInfo ? diffInfo.textColor.replace('text-', 'border-') : 'border-border';

  return (
    <div>
      <div
        className={`flex items-center gap-2 flex-wrap hover:bg-accent transition-colors border-l-2 ${borderClass} ${isUpdate ? 'cursor-pointer' : ''}`}
        style={{ marginLeft: `${indent}px`, padding: '8px 12px' }}
        onClick={() => isUpdate && onUpdateClick(id)}
      >
        {diffBadge}
        <span className="font-medium text-foreground">{name}</span>
        <span className="text-muted-foreground text-xs">({id})</span>
        {otherFields}
        {isUpdate && <span className="text-xs text-primary">点击查看详情</span>}
      </div>
      {hasChildren && (
        <div>
          {node._children.map((child) => (
            <TreeNodeComponent
              key={child._id}
              node={child}
              level={level + 1}
              fields={fields}
              onUpdateClick={onUpdateClick}
              showDiffOnly={showDiffOnly}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface UpdateDetail {
  key: string;
  oldVal: unknown;
  newVal: unknown;
}

interface DataDiffViewProps {
  onBack?: () => void;
}

export function DataDiffView({ onBack }: DataDiffViewProps) {
  const [dataA, setDataA] = useState(`[
  { "id": "1", "name": "根节点", "pid": "0" },
  { "id": "2", "name": "子节点A", "pid": "1" },
  { "id": "3", "name": "子节点B", "pid": "1" }
]`);
  const [dataB, setDataB] = useState(`[
  { "id": "1", "name": "根节点", "pid": "0" },
  { "id": "2", "name": "子节点A-修改", "pid": "1" },
  { "id": "4", "name": "新节点", "pid": "1" }
]`);
  const [error, setError] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [showDiffOnly, setShowDiffOnly] = useState(false);

  const [diffResult, setDiffResult] = useState<DiffItem[]>([]);
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [currentFields, setCurrentFields] = useState<{
    idField: string;
    nameField: string;
    pidField: string;
    childrenField: string;
  } | null>(null);
  const [originalDataA, setOriginalDataA] = useState<Record<string, unknown>[]>([]);
  const [originalDataB, setOriginalDataB] = useState<Record<string, unknown>[]>([]);

  const [updateDetails, setUpdateDetails] = useState<UpdateDetail[]>([]);
  const [showModal, setShowModal] = useState(false);

  const handleCompare = useCallback(() => {
    setError(null);

    if (!dataA.trim() || !dataB.trim()) {
      setError('请填写两组数据');
      return;
    }

    try {
      const tempA = JSON.parse(dataA);
      const tempB = JSON.parse(dataB);
      const sampleData = Array.isArray(tempA) ? tempA : tempB;
      const parsedSample = Array.isArray(sampleData) ? sampleData : [sampleData];

      const childrenField = detectField(parsedSample, CHILDREN_PATTERNS) || 'children';

      const parsedDataA = parseData(dataA, childrenField);
      const parsedDataB = parseData(dataB, childrenField);

      setOriginalDataA(parsedDataA);
      setOriginalDataB(parsedDataB);

      const fields = detectFields(parsedDataA.length > 0 ? parsedDataA : parsedDataB);
      setCurrentFields(fields);

      const { diffResult: result, allData } = processDiff(parsedDataA, parsedDataB, fields);
      setDiffResult(result);

      const tree = buildTree(
        allData,
        fields,
        new Map(result.map((r) => [String(r[fields.idField]), r.type]))
      );
      setTreeData(tree);

      setShowResult(true);
    } catch (err) {
      setError('处理失败: ' + (err instanceof Error ? err.message : String(err)));
    }
  }, [dataA, dataB]);

  const handleClear = useCallback(() => {
    setDataA('');
    setDataB('');
    setError(null);
  }, []);

  const handleUpdateClick = useCallback(
    (id: string) => {
      if (!currentFields) return;

      const itemA = originalDataA.find((item) => String(item[currentFields.idField]) === id);
      const itemB = originalDataB.find((item) => String(item[currentFields.idField]) === id);

      if (!itemA || !itemB) return;

      // 显示所有变化的字段
      const allKeys = new Set([...Object.keys(itemA), ...Object.keys(itemB)]);
      const changedFields: UpdateDetail[] = [];

      allKeys.forEach((key) => {
        // 排除内部字段和 id 字段本身
        if (['_id', '_pid', '_sort', '_children', '_diffType', currentFields.idField].includes(key))
          return;
        if (!isEqual(itemA[key], itemB[key])) {
          changedFields.push({ key, oldVal: itemA[key], newVal: itemB[key] });
        }
      });

      setUpdateDetails(changedFields);
      setShowModal(true);
    },
    [currentFields, originalDataA, originalDataB]
  );

  const formatValue = (val: unknown): string => {
    if (val == null) return 'null';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };

  const insertCount = diffResult.filter((r) => r.type === 'insert').length;
  const removeCount = diffResult.filter((r) => r.type === 'remove').length;
  const updateCount = diffResult.filter((r) => r.type === 'update').length;

  if (!showResult) {
    return (
      <div className="flex flex-col h-full" data-testid="data-diff-view">
        {/* 头部 */}
        <div className="flex items-center gap-3 p-4 border-b border-border shrink-0 bg-background">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} title="返回工具箱">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-foreground">树形数据对比</h2>
            <p className="text-sm text-muted-foreground">
              输入两组树形/扁平数据，自动检测层级关系并对比差异
            </p>
          </div>
        </div>

        {/* 输入区域 */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          {/* 数据源输入 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>数据源 A（旧）</Label>
              <Textarea
                value={dataA}
                onChange={(e) => setDataA(e.target.value)}
                placeholder='扁平数据: [{"id":"1","name":"节点1","pid":"0",...}]&#10;&#10;树形数据: [{"id":"1","name":"节点1","children":[...]}]'
                className="font-mono text-xs min-h-[280px]"
              />
            </div>
            <div className="space-y-2">
              <Label>数据源 B（新）</Label>
              <Textarea
                value={dataB}
                onChange={(e) => setDataB(e.target.value)}
                placeholder='扁平数据: [{"id":"1","name":"节点1","pid":"0",...}]&#10;&#10;树形数据: [{"id":"1","name":"节点1","children":[...]}]'
                className="font-mono text-xs min-h-[280px]"
              />
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={handleClear}>
              清空
            </Button>
            <Button onClick={handleCompare}>开始对比</Button>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="p-3 rounded-lg border border-destructive/50 bg-destructive/5 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-testid="data-diff-view">
      {/* 头部 */}
      <div className="flex items-center gap-3 p-4 border-b border-border shrink-0 bg-background">
        <Button variant="ghost" size="icon" onClick={() => setShowResult(false)} title="返回输入">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-foreground">差异对比结果</h2>
          <p className="text-sm text-muted-foreground">完整展示数据层级结构，差异项已用标签标记</p>
        </div>
      </div>

      {/* 统计 & 筛选 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">差异统计：</span>
          <span className="px-2 py-1 rounded text-xs font-medium bg-success/10 text-success border border-success/20">
            +{insertCount}
          </span>
          <span className="px-2 py-1 rounded text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20">
            -{removeCount}
          </span>
          <span className="px-2 py-1 rounded text-xs font-medium bg-primary/10 text-primary border border-primary/20">
            ~{updateCount}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="showDiffOnly"
            checked={showDiffOnly}
            onCheckedChange={(checked) => setShowDiffOnly(checked === true)}
          />
          <Label htmlFor="showDiffOnly" className="text-xs text-muted-foreground cursor-pointer">
            仅显示差异
          </Label>
        </div>
      </div>

      {/* 树形容器 */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {treeData.map((node) => (
          <TreeNodeComponent
            key={node._id}
            node={node}
            level={0}
            fields={currentFields || { idField: 'id', nameField: 'name' }}
            onUpdateClick={handleUpdateClick}
            showDiffOnly={showDiffOnly}
          />
        ))}
      </div>

      {/* 变更详情弹窗 */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-background rounded-lg w-[90%] max-w-2xl max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-base font-semibold text-foreground">变更详情</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowModal(false)}>
                &times;
              </Button>
            </div>
            <div className="p-4 space-y-3">
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs text-primary">
                💡 <strong>提示：</strong>将 <strong>B 数据源（新值）</strong> 填写到对应系统
              </div>
              {updateDetails.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4">
                  未检测到字段变化
                </div>
              ) : (
                <div className="space-y-3">
                  {updateDetails.map((detail) => (
                    <div key={detail.key} className="p-3 rounded-lg border border-border bg-card">
                      <div className="text-sm font-medium text-foreground mb-2">{detail.key}</div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-2 rounded bg-destructive/5 border border-destructive/20">
                          <div className="text-xs font-medium text-destructive mb-1">旧值</div>
                          <div className="font-mono text-xs text-foreground break-all">
                            {formatValue(detail.oldVal)}
                          </div>
                        </div>
                        <div className="p-2 rounded bg-success/5 border border-success/20">
                          <div className="text-xs font-medium text-success mb-1">新值</div>
                          <div className="font-mono text-xs text-foreground break-all">
                            {formatValue(detail.newVal)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
