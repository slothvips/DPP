import { AlertTriangle, CheckCircle2, Download, LoaderCircle, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { RebuildPhase } from './useOptionsImportAndReset';

interface DataManagementSectionProps {
  onExport: () => void;
  onImport: () => void;
  onRebuild: () => void | Promise<void>;
  rebuildPhase: RebuildPhase;
}

export function DataManagementSection({
  onExport,
  onImport,
  onRebuild,
  rebuildPhase,
}: DataManagementSectionProps) {
  const phaseDetails = rebuildPhase
    ? {
        preparing: { label: '正在准备同步引擎', progress: 15, step: 1 },
        clearing: { label: '正在清空本地同步数据', progress: 45, step: 2 },
        pulling: { label: '正在从服务器拉取并恢复数据', progress: 80, step: 3 },
        complete: { label: '数据重建完成，正在刷新页面', progress: 100, step: 3 },
      }[rebuildPhase]
    : null;

  return (
    <>
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
              disabled={rebuildPhase !== null}
            >
              <Download className="w-4 h-4 shrink-0" />
              导出配置
            </Button>
            <Button
              onClick={onImport}
              variant="outline"
              className="min-w-0 flex-1 gap-2 sm:flex-none"
              data-testid="button-import"
              disabled={rebuildPhase !== null}
            >
              <Upload className="w-4 h-4 shrink-0" />
              导入配置
            </Button>
            <Button
              onClick={onRebuild}
              variant="outline"
              className="min-w-0 flex-1 gap-2 text-warning border-warning hover:bg-warning/10 sm:flex-none"
              data-testid="button-rebuild"
              disabled={rebuildPhase !== null}
            >
              <AlertTriangle className="w-4 h-4 shrink-0" />
              重建本地数据
            </Button>
          </div>
        </div>
      </section>

      {phaseDetails && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rebuild-progress-title"
          data-testid="rebuild-progress"
        >
          <div className="w-full max-w-md space-y-5 rounded-lg border bg-background p-6 shadow-lg">
            <div className="flex items-center gap-3">
              {rebuildPhase === 'complete' ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
              ) : (
                <LoaderCircle className="h-5 w-5 shrink-0 animate-spin text-primary" />
              )}
              <h2 id="rebuild-progress-title" className="text-lg font-semibold">
                重建本地数据
              </h2>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span>{phaseDetails.label}</span>
                <span className="shrink-0 text-muted-foreground">阶段 {phaseDetails.step}/3</span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label="本地数据重建进度"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={phaseDetails.progress}
                aria-valuetext={`${phaseDetails.label}，阶段 ${phaseDetails.step}/3`}
              >
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    rebuildPhase === 'complete' ? 'bg-success' : 'bg-primary animate-pulse'
                  }`}
                  style={{ width: `${phaseDetails.progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
