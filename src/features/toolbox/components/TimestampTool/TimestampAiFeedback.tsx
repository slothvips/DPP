interface TimestampAiFeedbackProps {
  aiError: string | null;
  aiReasoning: string | null;
  isInvalid: boolean;
}

export function TimestampAiFeedback({ aiError, aiReasoning, isInvalid }: TimestampAiFeedbackProps) {
  if (!isInvalid || !aiError) {
    return null;
  }

  return (
    <div className="p-3 rounded-lg border border-destructive/50 bg-destructive/5 space-y-1">
      <div className="text-sm text-destructive">{aiError}</div>
      {aiReasoning && <div className="text-xs text-muted-foreground italic">{aiReasoning}</div>}
    </div>
  );
}
