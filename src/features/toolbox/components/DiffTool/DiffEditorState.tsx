interface DiffEditorStateProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  editorError: string | null;
}

export function DiffEditorState({ containerRef, editorError }: DiffEditorStateProps) {
  if (editorError) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center bg-muted/30">
        <div className="text-center p-4">
          <p className="text-destructive font-medium mb-2">编辑器加载失败</p>
          <p className="text-sm text-muted-foreground">{editorError}</p>
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className="flex-1 min-h-0" />;
}
