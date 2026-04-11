import { Button } from '@/components/ui/button';
import { formatValue } from './dataDiffDiff';
import type { UpdateDetail } from './dataDiffTypes';

interface DataDiffUpdateModalProps {
  details: UpdateDetail[];
  onClose: () => void;
}

export function DataDiffUpdateModal({ details, onClose }: DataDiffUpdateModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-background rounded-lg w-[90%] max-w-2xl max-h-[80vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-base font-semibold text-foreground">变更详情</h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            &times;
          </Button>
        </div>
        <div className="p-4 space-y-3">
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs text-primary">
            提示：将 <strong>B 数据源（新值）</strong> 填写到对应系统
          </div>
          {details.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-4">未检测到字段变化</div>
          ) : (
            <div className="space-y-3">
              {details.map((detail) => (
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
  );
}
