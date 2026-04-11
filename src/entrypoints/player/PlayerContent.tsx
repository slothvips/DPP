interface PlayerContentProps {
  loading: boolean;
  error: string | null;
  hasPlayer: boolean;
  playerAreaRef: React.RefObject<HTMLDivElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function PlayerContent({
  loading,
  error,
  hasPlayer,
  playerAreaRef,
  containerRef,
}: PlayerContentProps) {
  return (
    <div className="h-full flex flex-col min-w-0">
      {loading && (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-lg">
          正在加载录制...
        </div>
      )}

      {error && (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-destructive bg-destructive/10 p-4 rounded-md border border-destructive/20">
            错误: {error}
          </div>
        </div>
      )}

      {!loading && !error && !hasPlayer && (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-muted-foreground border-2 border-dashed border-border rounded-lg p-12 text-center">
            <p>未加载录制。</p>
            <p className="text-sm mt-2">请从扩展程序弹窗中打开录制。</p>
          </div>
        </div>
      )}

      <div ref={playerAreaRef} className="flex-1 min-h-0 overflow-hidden bg-neutral-900 relative">
        <div ref={containerRef} className="absolute" />
      </div>
    </div>
  );
}
