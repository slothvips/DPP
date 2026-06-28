export function SidepanelHeader() {
  return (
    <header className="shrink-0 border-b border-border/50 bg-background/80 px-3 py-3 backdrop-blur [@media(max-height:520px)]:py-2 dark:bg-background/88">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/9 text-sm font-semibold text-primary ring-1 ring-primary/12">
          D
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold tracking-tight" data-testid="app-title">
              DPP
            </h1>
            {import.meta.env.MODE === 'development' && (
              <span className="rounded-md bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-destructive-foreground shadow-sm">
                DEV
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">你的侧边工作台</p>
        </div>
      </div>
    </header>
  );
}
