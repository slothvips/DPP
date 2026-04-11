import { useCallback, useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { useToast } from '@/components/ui/toast';
import {
  clearKey,
  exportKey,
  generateSyncKey,
  importKey,
  loadKey,
  storeKey,
} from '@/lib/crypto/encryption';
import { useConfirmDialog } from '@/utils/confirm-dialog';
import { logger } from '@/utils/logger';
import { useSyncKeyMigration } from './useSyncKeyMigration';

interface SyncKeyManagerOptions {
  onKeyChange?: (key: string) => void;
  onClear?: () => void;
  initialKeyLoaded?: boolean;
}

export function useSyncKeyManager({
  onKeyChange,
  onClear,
  initialKeyLoaded,
}: SyncKeyManagerOptions) {
  const { toast } = useToast();
  const { confirm } = useConfirmDialog();
  const [hasKey, setHasKey] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [keyString, setKeyString] = useState('');
  const [importInput, setImportInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const checkKey = useCallback(async () => {
    try {
      const key = await loadKey();
      if (key) {
        setHasKey(true);
        setKeyString(await exportKey(key));
        return;
      }

      setHasKey(false);
      setKeyString('');
    } catch (error) {
      logger.error('Failed to load key:', error);
    }
  }, []);

  useEffect(() => void checkKey(), [checkKey, initialKeyLoaded]);

  const {
    confirmText,
    handleGenerateNewKey,
    handleMigration,
    isChangeDialogOpen,
    isMigrating,
    migrationMode,
    newKeyInput,
    setConfirmText,
    setIsChangeDialogOpen,
    setMigrationMode,
    setNewKeyInput,
  } = useSyncKeyMigration({ checkKey, onKeyChange, toast });

  const handleGenerate = useCallback(async () => {
    try {
      setIsGenerating(true);
      const key = await generateSyncKey();
      await storeKey(key);
      await checkKey();
      toast('同步密钥已生成并保存', 'success');
      onKeyChange?.(await exportKey(key));
    } catch (error) {
      logger.error(error);
      toast('生成密钥失败', 'error');
    } finally {
      setIsGenerating(false);
    }
  }, [checkKey, onKeyChange, toast]);

  const handleImport = useCallback(async () => {
    if (!importInput.trim()) return;

    try {
      setIsImporting(true);
      const normalized = importInput.trim();
      const key = await importKey(normalized);
      await storeKey(key);
      await checkKey();
      toast('同步密钥已导入', 'success');
      onKeyChange?.(normalized);
    } catch (error) {
      logger.error(error);
      toast('无效的密钥格式', 'error');
    } finally {
      setIsImporting(false);
    }
  }, [checkKey, importInput, onKeyChange, toast]);

  const handleClear = useCallback(async () => {
    const confirmed = await confirm(
      '确定要清除同步密钥吗？\n\n如果没有密钥，您将无法解密服务器上的同步数据。请确保您已经备份了密钥。',
      '确认清除',
      'danger'
    );
    if (!confirmed) return;

    try {
      await clearKey();
      await checkKey();
      setShowKey(false);
      onClear?.();
      toast('同步密钥已清除', 'info');
    } catch (error) {
      logger.error(error);
      toast('清除密钥失败', 'error');
    }
  }, [checkKey, confirm, onClear, toast]);

  const handleCopyKey = useCallback(() => {
    navigator.clipboard.writeText(keyString);
    toast('密钥已复制到剪贴板', 'success');
  }, [keyString, toast]);

  const handleOpenDebugPage = useCallback(
    () => window.open(browser.runtime.getURL('/debug.html'), '_blank'),
    []
  );

  return {
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
  };
}
