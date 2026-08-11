import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { PersonalKeyCustodyGuideDialog } from './PersonalKeyCustodyGuideDialog';
import { PersonalKeyEmptyState } from './PersonalKeyEmptyState';
import { PersonalKeyEnabledState } from './PersonalKeyEnabledState';
import { PersonalKeyNeedsServerState } from './PersonalKeyNeedsServerState';
import { PersonalKeySetupProgress } from './PersonalKeySetupProgress';
import { PersonalSyncStatus } from './PersonalSyncStatus';
import { usePersonalKeyManager } from './usePersonalKeyManager';

function useSyncServerConfigured(): boolean | undefined {
  return useLiveQuery(async () => {
    const setting = await db.settings.get('custom_server_url');
    return typeof setting?.value === 'string' && setting.value.trim().length > 0;
  }, []);
}

export function PersonalKeyManager() {
  const syncServerConfigured = useSyncServerConfigured();
  const {
    custodyGuideKey,
    dismissSetupProgress,
    handleClear,
    handleCopyKey,
    handleCustodyGuideOpenChange,
    handleGenerate,
    handleGenerateReplace,
    handleImport,
    handleReplace,
    handleToggleShowKey,
    hasKey,
    importInput,
    isCustodyGuideOpen,
    isGenerating,
    isImporting,
    isReplaceOpen,
    isReplacing,
    isSetupRunning,
    keyString,
    openCustodyGuide,
    replaceInput,
    setImportInput,
    setIsReplaceOpen,
    setReplaceInput,
    setupProgress,
    showKey,
  } = usePersonalKeyManager();

  return (
    <div className="space-y-3">
      {hasKey ? (
        <PersonalKeyEnabledState
          actionsDisabled={isSetupRunning}
          replaceDisabled={syncServerConfigured === false}
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
      ) : syncServerConfigured === false ? (
        <PersonalKeyNeedsServerState />
      ) : syncServerConfigured === true ? (
        <PersonalKeyEmptyState
          importInput={importInput}
          isGenerating={isGenerating || isSetupRunning}
          isImporting={isImporting || isSetupRunning}
          onGenerate={() => void handleGenerate()}
          onImport={() => void handleImport()}
          onImportInputChange={setImportInput}
        />
      ) : null}
      {syncServerConfigured === false && hasKey ? (
        <p
          className="text-[11px] leading-5 text-muted-foreground"
          data-testid="personal-key-server-hint"
        >
          更换个人私钥前请先重新配置并保存同步服务器地址。清除私钥不受影响。
        </p>
      ) : null}
      {setupProgress ? (
        <PersonalKeySetupProgress
          progress={setupProgress}
          onDismissError={dismissSetupProgress}
          onOpenCustodyGuide={() => void openCustodyGuide()}
        />
      ) : (
        <PersonalSyncStatus />
      )}
      <PersonalKeyCustodyGuideDialog
        open={isCustodyGuideOpen}
        keyString={custodyGuideKey}
        onCopyKey={handleCopyKey}
        onOpenChange={handleCustodyGuideOpenChange}
      />
    </div>
  );
}
