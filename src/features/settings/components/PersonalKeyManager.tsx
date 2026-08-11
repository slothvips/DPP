import { PersonalKeyEmptyState } from './PersonalKeyEmptyState';
import { PersonalKeyEnabledState } from './PersonalKeyEnabledState';
import { PersonalSyncStatus } from './PersonalSyncStatus';
import { usePersonalKeyManager } from './usePersonalKeyManager';

export function PersonalKeyManager() {
  const {
    handleClear,
    handleCopyKey,
    handleGenerate,
    handleGenerateReplace,
    handleImport,
    handleReplace,
    handleToggleShowKey,
    hasKey,
    importInput,
    isGenerating,
    isImporting,
    isReplaceOpen,
    isReplacing,
    keyString,
    replaceInput,
    setImportInput,
    setIsReplaceOpen,
    setReplaceInput,
    showKey,
  } = usePersonalKeyManager();

  return (
    <div className="space-y-3">
      {hasKey ? (
        <PersonalKeyEnabledState
          isReplaceOpen={isReplaceOpen}
          isReplacing={isReplacing}
          keyString={keyString}
          replaceInput={replaceInput}
          showKey={showKey}
          onClear={() => void handleClear()}
          onCopyKey={handleCopyKey}
          onGenerateReplace={() => void handleGenerateReplace()}
          onReplace={() => void handleReplace()}
          onReplaceInputChange={setReplaceInput}
          onReplaceOpenChange={setIsReplaceOpen}
          onToggleShowKey={() => void handleToggleShowKey()}
        />
      ) : (
        <PersonalKeyEmptyState
          importInput={importInput}
          isGenerating={isGenerating}
          isImporting={isImporting}
          onGenerate={() => void handleGenerate()}
          onImport={() => void handleImport()}
          onImportInputChange={setImportInput}
        />
      )}
      <PersonalSyncStatus />
    </div>
  );
}
