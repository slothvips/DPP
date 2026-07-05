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
    <div className="flex h-full min-h-0 min-w-0 flex-col p-4" data-testid="toolbox-view">
      <ToolboxToolGrid onSelectTool={handleSelectTool} />
    </div>
  );
}
