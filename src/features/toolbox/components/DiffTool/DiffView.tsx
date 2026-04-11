import { DiffAiPanel } from './DiffAiPanel';
import { DiffEditorState } from './DiffEditorState';
import { DiffHeader } from './DiffHeader';
import { useDiffAiSummary } from './useDiffAiSummary';
import { useDiffEditor } from './useDiffEditor';

export function DiffView() {
  const { containerRef, editorError, editorRef, handleSwap } = useDiffEditor();
  const {
    aiError,
    aiLoading,
    aiSummary,
    copied,
    handleAISummarize,
    handleCopySummary,
    setShowAIPanel,
    showAIPanel,
  } = useDiffAiSummary(editorRef);

  return (
    <div className="flex flex-col h-full w-full" data-testid="diff-view">
      <DiffHeader aiLoading={aiLoading} onAISummarize={handleAISummarize} onSwap={handleSwap} />

      {/* AI 解读面板 */}
      {showAIPanel && (
        <DiffAiPanel
          aiError={aiError}
          aiLoading={aiLoading}
          aiSummary={aiSummary}
          copied={copied}
          onClose={() => setShowAIPanel(false)}
          onCopy={handleCopySummary}
        />
      )}

      <DiffEditorState containerRef={containerRef} editorError={editorError} />
    </div>
  );
}
