import { memo } from 'react';
import { getDiffInfo, nodeHasDiff } from './dataDiffDiff';
import type { DiffFields, TreeNode } from './dataDiffTypes';

interface DataDiffTreeProps {
  fields: Pick<DiffFields, 'idField' | 'nameField'>;
  nodes: TreeNode[];
  onUpdateClick: (id: string) => void;
  showDiffOnly?: boolean;
}

interface TreeNodeRowProps {
  node: TreeNode;
  level: number;
  fields: Pick<DiffFields, 'idField' | 'nameField'>;
  onUpdateClick: (id: string) => void;
  showDiffOnly?: boolean;
}

function arePropsEqual(prevProps: TreeNodeRowProps, nextProps: TreeNodeRowProps): boolean {
  if (
    prevProps.level !== nextProps.level ||
    prevProps.showDiffOnly !== nextProps.showDiffOnly ||
    prevProps.fields.idField !== nextProps.fields.idField ||
    prevProps.fields.nameField !== nextProps.fields.nameField
  ) {
    return false;
  }

  const prevNode = prevProps.node;
  const nextNode = nextProps.node;
  if (
    prevNode._id !== nextNode._id ||
    prevNode._diffType !== nextNode._diffType ||
    prevNode._children.length !== nextNode._children.length
  ) {
    return false;
  }

  return prevNode[nextProps.fields.nameField] === nextNode[nextProps.fields.nameField];
}

const TreeNodeRow = memo(function TreeNodeRow({
  node,
  level,
  fields,
  onUpdateClick,
  showDiffOnly,
}: TreeNodeRowProps) {
  const indent = level * 20;
  const diffInfo = getDiffInfo(node._diffType);
  const hasAnyDiff = nodeHasDiff(node);
  if (showDiffOnly && !hasAnyDiff) return null;

  const name = (node[fields.nameField] as string) || (node[fields.idField] as string) || '(无名称)';
  const id = String(node[fields.idField] ?? '');
  const isUpdate = diffInfo?.label === '更新';
  const borderClass = diffInfo ? diffInfo.textColor.replace('text-', 'border-') : 'border-border';

  const otherFields = Object.entries(node)
    .filter(
      ([key, value]) =>
        ![
          '_id',
          '_pid',
          '_sort',
          '_children',
          '_diffType',
          fields.idField,
          fields.nameField,
        ].includes(key) && value != null
    )
    .slice(0, 3)
    .map(([key, value]) => (
      <span key={key} className="text-muted-foreground">
        {key}: {String(value).slice(0, 20)}
      </span>
    ));

  return (
    <div>
      <div
        className={`flex items-center gap-2 flex-wrap hover:bg-accent transition-colors border-l-2 ${borderClass} ${isUpdate ? 'cursor-pointer' : ''}`}
        style={{ marginLeft: `${indent}px`, padding: '8px 12px' }}
        onClick={() => isUpdate && onUpdateClick(id)}
      >
        {diffInfo && (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${diffInfo.bg} ${diffInfo.textColor} ${diffInfo.border}`}
          >
            {diffInfo.label}
          </span>
        )}
        <span className="font-medium text-foreground">{name}</span>
        <span className="text-muted-foreground text-xs">({id})</span>
        {otherFields}
        {isUpdate && <span className="text-xs text-primary">点击查看详情</span>}
      </div>
      {node._children.length > 0 &&
        node._children.map((child) => (
          <TreeNodeRow
            key={child._id}
            node={child}
            level={level + 1}
            fields={fields}
            onUpdateClick={onUpdateClick}
            showDiffOnly={showDiffOnly}
          />
        ))}
    </div>
  );
}, arePropsEqual);

export function DataDiffTree({ fields, nodes, onUpdateClick, showDiffOnly }: DataDiffTreeProps) {
  return nodes.map((node) => (
    <TreeNodeRow
      key={node._id}
      node={node}
      level={0}
      fields={fields}
      onUpdateClick={onUpdateClick}
      showDiffOnly={showDiffOnly}
    />
  ));
}
