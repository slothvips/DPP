import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { DataDiffTree } from './DataDiffTree';
import type { ParsedFields } from './dataDiffTypes';

interface DataDiffResultPanelProps {
  counts: {
    insertCount: number;
    removeCount: number;
    updateCount: number;
  };
  currentFields: ParsedFields | null;
  onShowDiffOnlyChange: (value: boolean) => void;
  onUpdateClick: (id: string) => void;
  showDiffOnly: boolean;
  treeData: Parameters<typeof DataDiffTree>[0]['nodes'];
}

export function DataDiffResultPanel({
  counts,
  currentFields,
  onShowDiffOnlyChange,
  onUpdateClick,
  showDiffOnly,
  treeData,
}: DataDiffResultPanelProps) {
  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">差异统计：</span>
          <span className="px-2 py-1 rounded text-xs font-medium bg-success/10 text-success border border-success/20">
            +{counts.insertCount}
          </span>
          <span className="px-2 py-1 rounded text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20">
            -{counts.removeCount}
          </span>
          <span className="px-2 py-1 rounded text-xs font-medium bg-primary/10 text-primary border border-primary/20">
            ~{counts.updateCount}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="showDiffOnly"
            checked={showDiffOnly}
            onCheckedChange={(checked) => onShowDiffOnlyChange(checked === true)}
          />
          <Label htmlFor="showDiffOnly" className="text-xs text-muted-foreground cursor-pointer">
            仅显示差异
          </Label>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        <DataDiffTree
          nodes={treeData}
          fields={currentFields || { idField: 'id', nameField: 'name' }}
          onUpdateClick={onUpdateClick}
          showDiffOnly={showDiffOnly}
        />
      </div>
    </>
  );
}
