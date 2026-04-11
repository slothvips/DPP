import { ExternalLink } from 'lucide-react';
import { TOOLBOX_TOOLS, type ToolboxTool, showsExternalLink } from './toolboxShared';

interface ToolboxToolGridProps {
  onSelectTool: (tool: ToolboxTool) => void;
}

export function ToolboxToolGrid({ onSelectTool }: ToolboxToolGridProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {TOOLBOX_TOOLS.map((tool) => {
        const Icon = tool.icon;

        return (
          <button
            key={tool.id}
            onClick={() => onSelectTool(tool)}
            className="flex flex-col items-start gap-3 p-4 rounded-lg border bg-card text-card-foreground hover:bg-accent hover:text-accent-foreground transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center p-2 rounded-md bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </div>
              <span className="font-medium">{tool.name}</span>
              {showsExternalLink(tool) && (
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
              )}
            </div>
            <p className="text-sm text-muted-foreground">{tool.description}</p>
          </button>
        );
      })}
    </div>
  );
}
