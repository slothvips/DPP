interface NetworkPanelToolbarProps {
  filter: string;
  onFilterChange: (value: string) => void;
  statusCounts: {
    past: number;
    active: number;
    future: number;
  };
}

export function NetworkPanelToolbar({
  filter,
  onFilterChange,
  statusCounts,
}: NetworkPanelToolbarProps) {
  return (
    <div className="flex items-center gap-2 p-2 border-b bg-muted/30">
      <input
        type="text"
        placeholder="过滤请求..."
        value={filter}
        onChange={(event) => onFilterChange(event.target.value)}
        className="flex-1 px-2 py-1 text-sm border rounded bg-background"
      />
      <div className="flex items-center gap-2 text-xs">
        <span className="text-success dark:text-success">{statusCounts.past}</span>
        <span className="text-muted-foreground">/</span>
        <span className="text-primary">{statusCounts.active}</span>
        <span className="text-muted-foreground">/</span>
        <span className="text-muted-foreground">{statusCounts.future}</span>
      </div>
    </div>
  );
}
