import { Box } from 'lucide-react';
import { JsonView } from './JsonTool/JsonView';
import { RegexView } from './RegexTool/RegexView';
import { TimestampView } from './TimestampTool/TimestampView';
import { ToolboxToolGrid } from './ToolboxToolGrid';
import { useToolboxView } from './useToolboxView';

export function ToolboxView() {
  const { activeTool, handleBack, handleSelectTool } = useToolboxView();

  if (activeTool === 'regex') {
    return <RegexView onBack={handleBack} />;
  }

  if (activeTool === 'timestamp') {
    return <TimestampView onBack={handleBack} />;
  }

  if (activeTool === 'json') {
    return <JsonView onBack={handleBack} />;
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4" data-testid="toolbox-view">
      <div className="rounded-2xl border border-border/60 bg-warning/6 p-4 ring-1 ring-warning/8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/12 text-warning ring-1 ring-warning/12">
            <Box className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-foreground">游乐园</h2>
            <p className="mt-1 text-xs text-muted-foreground">选择一个项目开始使用</p>
          </div>
        </div>
      </div>

      <ToolboxToolGrid onSelectTool={handleSelectTool} />
    </div>
  );
}
