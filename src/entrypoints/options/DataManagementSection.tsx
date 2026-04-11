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
    <section className="space-y-4 border p-4 rounded-lg">
      <h2 className="text-xl font-semibold">数据管理</h2>
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          导出仅包含关键配置项，链接和任务数据请通过远程同步获取。
        </p>
        <div className="flex gap-2">
          <Button
            onClick={onExport}
            variant="outline"
            className="gap-2"
            data-testid="button-export"
          >
            <Download className="w-4 h-4" />
            导出配置
          </Button>
          <Button
            onClick={onImport}
            variant="outline"
            className="gap-2"
            data-testid="button-import"
          >
            <Upload className="w-4 h-4" />
            导入配置
          </Button>
          <Button
            onClick={onRebuild}
            variant="outline"
            className="gap-2 text-warning border-warning hover:bg-warning/10"
            data-testid="button-rebuild"
          >
            <AlertTriangle className="w-4 h-4" />
            重建本地数据
          </Button>
        </div>
      </div>
    </section>
  );
}
