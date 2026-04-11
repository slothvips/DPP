import { TimestampAiFeedback } from './TimestampAiFeedback';
import { TimestampControls } from './TimestampControls';
import { TimestampHeader } from './TimestampHeader';
import { TimestampResult } from './TimestampResult';
import { useTimestampView } from './useTimestampView';

export function TimestampView({ onBack }: { onBack?: () => void }) {
  const {
    aiCorrectedInput,
    aiError,
    aiReasoning,
    copied,
    copyToClipboard,
    dateDetails,
    handleAiFix,
    handleInputChange,
    handleTimezoneChange,
    isAiFixing,
    isInvalid,
    timestampInput,
    timezone,
  } = useTimestampView();

  return (
    <div className="flex flex-col h-full" data-testid="timestamp-view">
      <TimestampHeader onBack={onBack} />

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        <TimestampControls
          inputValue={timestampInput}
          isAiFixing={isAiFixing}
          isInvalid={isInvalid}
          onAiFix={handleAiFix}
          onInputChange={handleInputChange}
          onTimezoneChange={handleTimezoneChange}
          timezone={timezone}
        />

        {timestampInput && dateDetails && (
          <TimestampResult
            aiCorrectedInput={aiCorrectedInput}
            aiReasoning={aiReasoning}
            copied={copied}
            currentInput={timestampInput}
            dateDetails={dateDetails}
            onCopy={copyToClipboard}
          />
        )}

        <TimestampAiFeedback aiError={aiError} aiReasoning={aiReasoning} isInvalid={isInvalid} />
      </div>
    </div>
  );
}
