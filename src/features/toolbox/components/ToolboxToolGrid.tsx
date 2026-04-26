import { ExternalLink } from 'lucide-react';
import { TOOLBOX_TOOLS, type ToolboxTool, showsExternalLink } from './toolboxShared';

interface ToolboxToolGridProps {
  onSelectTool: (tool: ToolboxTool) => void;
}

export function ToolboxToolGrid({ onSelectTool }: ToolboxToolGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {TOOLBOX_TOOLS.map((tool) => {
        const Icon = tool.icon;

        return (
          <button
            key={tool.id}
            onClick={() => onSelectTool(tool)}
            className="group flex min-h-[112px] flex-col items-start justify-between gap-2 rounded-2xl border border-border/60 bg-background/90 p-4 text-left text-card-foreground transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/16 hover:bg-background/96 hover:shadow-sm"
          >
            <div className="flex w-full items-start gap-2">
              <div
                className={`flex items-center justify-center rounded-xl p-2 ring-1 ring-inset transition-colors ${tool.accentClassName}`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <span className="line-clamp-2 pr-2 font-medium leading-6 text-foreground">
                {tool.name}
              </span>
              {showsExternalLink(tool) && (
                <ExternalLink className="ml-auto mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
              )}
            </div>
            <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
              {tool.description}
            </p>
          </button>
        );
      })}
    </div>
  );
}
