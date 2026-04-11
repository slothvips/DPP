export interface DiffFields {
  idField: string;
  nameField: string;
  pidField: string;
  childrenField: string;
}

export interface BuildTreeFields {
  idField: string;
  pidField: string;
  sortField: string;
}

export interface ParsedFields extends DiffFields {
  sortField: string;
}

export interface DiffItem extends Record<string, unknown> {
  type: 'insert' | 'remove' | 'update';
}

export interface TreeNode extends Record<string, unknown> {
  _id: string;
  _pid: string;
  _sort: number;
  _children: TreeNode[];
  _diffType: string | null;
}

export interface DiffInfo {
  label: string;
  bg: string;
  border: string;
  textColor: string;
}

export interface UpdateDetail {
  key: string;
  oldVal: unknown;
  newVal: unknown;
}

export interface DataDiffViewProps {
  onBack?: () => void;
}
