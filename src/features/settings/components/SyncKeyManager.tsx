import { SyncKeyEmptyState } from './SyncKeyEmptyState';
import { SyncKeyEnabledState } from './SyncKeyEnabledState';
import { useSyncKeyManager } from './useSyncKeyManager';

interface SyncKeyManagerProps {
  // Optional callback to notify parent when key changes
  onKeyChange?: (key: string) => void;
  // Optional callback to notify parent when key is cleared
  onClear?: () => void;
  // Optional prop to trigger key check from parent
  initialKeyLoaded?: boolean;
}

export function SyncKeyManager({
  onKeyChange,
  onClear,
  initialKeyLoaded,
}: SyncKeyManagerProps = {}) {
  const {
    confirmText,
    handleClear,
    handleCopyKey,
    handleGenerate,
    handleGenerateNewKey,
    handleImport,
    handleMigration,
    handleOpenDebugPage,
    hasKey,
    importInput,
    isChangeDialogOpen,
    isGenerating,
    isImporting,
    isMigrating,
    keyString,
    migrationMode,
    newKeyInput,
    setConfirmText,
    setImportInput,
    setIsChangeDialogOpen,
    setMigrationMode,
    setNewKeyInput,
    setShowKey,
    showKey,
  } = useSyncKeyManager({ onKeyChange, onClear, initialKeyLoaded });

  if (hasKey) {
    return (
      <SyncKeyEnabledState
        confirmText={confirmText}
        isChangeDialogOpen={isChangeDialogOpen}
        isMigrating={isMigrating}
        keyString={keyString}
        migrationMode={migrationMode}
        newKeyInput={newKeyInput}
        onClear={handleClear}
        onConfirmTextChange={setConfirmText}
        onCopyKey={handleCopyKey}
        onDebug={handleOpenDebugPage}
        onGenerateNewKey={handleGenerateNewKey}
        onMigrationModeChange={setMigrationMode}
        onNewKeyInputChange={setNewKeyInput}
        onOpenChange={setIsChangeDialogOpen}
        onSubmitMigration={handleMigration}
        onToggleShowKey={() => setShowKey(!showKey)}
        showKey={showKey}
      />
    );
  }

  return (
    <SyncKeyEmptyState
      importInput={importInput}
      isGenerating={isGenerating}
      isImporting={isImporting}
      onGenerate={handleGenerate}
      onImport={handleImport}
      onImportInputChange={setImportInput}
    />
  );
}
