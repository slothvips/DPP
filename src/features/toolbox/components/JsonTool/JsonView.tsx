import { JsonErrorPanel } from './JsonErrorPanel';
import { JsonToolbar } from './JsonToolbar';
import { JsonViewHeader } from './JsonViewHeader';
import { useJsonView } from './useJsonView';

export function JsonView({ onBack }: { onBack?: () => void }) {
  const {
    aiError,
    aiFixing,
    containerRef,
    copied,
    error,
    handleAIFix,
    handleClear,
    handleCopy,
    handleCopyError,
    handleExport,
    handleFormat,
    handleImport,
    handleMinify,
    hasValue,
    isFormatted,
    showErrors,
    toggleErrors,
  } = useJsonView();

  return (
    <div className="flex flex-col h-full w-full" data-testid="json-view">
      <JsonViewHeader
        copied={copied}
        error={error}
        hasValue={hasValue}
        isFormatted={isFormatted}
        onBack={onBack}
        onClear={handleClear}
        onCopy={handleCopy}
        onExport={handleExport}
        onImport={handleImport}
      />

      {error && (
        <JsonErrorPanel
          error={error}
          onCopyError={handleCopyError}
          onToggle={toggleErrors}
          showErrors={showErrors}
        />
      )}

      <JsonToolbar
        aiError={aiError}
        aiFixing={aiFixing}
        disabled={!!error}
        onAIFix={handleAIFix}
        onFormat={handleFormat}
        onMinify={handleMinify}
      />

      {/* Monaco Editor */}
      <div ref={containerRef} className="flex-1 min-h-0" />
    </div>
  );
}
