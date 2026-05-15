import { AlertTriangle, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DataManagementSectionProps {
  onExport: () => void;
  onImport: () => void;
  onRebuild: () => void | Promise<void>;
}

export function DataManagementSection({
  onExport,
  onImport,
  onRebuild,
}: DataManagementSectionProps) {
  return (
    <section className="min-w-0 space-y-4 rounded-lg border p-4">
      <h2 className="text-xl font-semibold">数据管理</h2>
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          导出仅包含关键配置项，链接和任务数据请通过远程同步获取。
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={onExport}
            variant="outline"
            className="min-w-0 flex-1 gap-2 sm:flex-none"
            data-testid="button-export"
          >
            <Download className="w-4 h-4 shrink-0" />
            导出配置
          </Button>
          <Button
            onClick={onImport}
            variant="outline"
            className="min-w-0 flex-1 gap-2 sm:flex-none"
            data-testid="button-import"
          >
            <Upload className="w-4 h-4 shrink-0" />
            导入配置
          </Button>
          <Button
            onClick={onRebuild}
            variant="outline"
            className="min-w-0 flex-1 gap-2 text-warning border-warning hover:bg-warning/10 sm:flex-none"
            data-testid="button-rebuild"
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            重建本地数据
          </Button>
        </div>
      </div>
    </section>
  );
}
