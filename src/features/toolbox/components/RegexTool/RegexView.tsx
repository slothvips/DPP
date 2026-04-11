import { RegexControls } from './RegexControls';
import { RegexHeader } from './RegexHeader';
import { RegexResults } from './RegexResults';
import { useRegexView } from './useRegexView';

export function RegexView({ onBack }: { onBack?: () => void }) {
  const {
    applyPreset,
    copied,
    error,
    flags,
    handleCopy,
    highlightedText,
    matches,
    pattern,
    setPattern,
    setTestString,
    testString,
    toggleFlag,
  } = useRegexView();

  return (
    <div className="flex flex-col h-full" data-testid="regex-view">
      <RegexHeader
        onBack={onBack}
        copied={copied}
        hasMatches={matches.length > 0}
        onCopy={handleCopy}
      />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <RegexControls
          pattern={pattern}
          error={error}
          flags={flags}
          testString={testString}
          onPatternChange={setPattern}
          onTestStringChange={setTestString}
          onToggleFlag={toggleFlag}
        />

        <RegexResults
          testString={testString}
          matches={matches}
          highlightedText={highlightedText}
          onApplyPreset={applyPreset}
        />
      </div>
    </div>
  );
}
