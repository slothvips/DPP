import { PersonalKeyEmptyState } from './PersonalKeyEmptyState';
import { PersonalKeyEnabledState } from './PersonalKeyEnabledState';
import { usePersonalKeyManager } from './usePersonalKeyManager';

export function PersonalKeyManager() {
  const {
    handleClear,
    handleCopyKey,
    handleGenerate,
    handleGenerateReplace,
    handleImport,
    handleReplace,
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
    setShowKey,
    showKey,
  } = usePersonalKeyManager();

  if (hasKey) {
    return (
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
        onToggleShowKey={() => setShowKey(!showKey)}
      />
    );
  }

  return (
    <PersonalKeyEmptyState
      importInput={importInput}
      isGenerating={isGenerating}
      isImporting={isImporting}
      onGenerate={() => void handleGenerate()}
      onImport={() => void handleImport()}
      onImportInputChange={setImportInput}
    />
  );
}
