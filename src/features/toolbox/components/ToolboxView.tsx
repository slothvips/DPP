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
    <div className="flex flex-col h-full p-4" data-testid="toolbox-view">
      <div className="mb-6">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Box className="h-5 w-5" />
          游乐园
        </h2>
        <p className="text-sm text-muted-foreground mt-1">选择一个项目开始使用</p>
      </div>

      <ToolboxToolGrid onSelectTool={handleSelectTool} />
    </div>
  );
}
