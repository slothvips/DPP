import { useCallback, useState } from 'react';
import { getSyncEngine } from '@/db';
import {
  exportKey,
  generateSyncKey,
  importKey,
  storeKey,
  verifyKey,
} from '@/lib/crypto/encryption';
import { logger } from '@/utils/logger';

interface UseSyncKeyMigrationOptions {
  checkKey: () => Promise<void>;
  onKeyChange?: (key: string) => void;
  toast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export function useSyncKeyMigration({ checkKey, onKeyChange, toast }: UseSyncKeyMigrationOptions) {
  const [isChangeDialogOpen, setIsChangeDialogOpen] = useState(false);
  const [newKeyInput, setNewKeyInput] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [migrationMode, setMigrationMode] = useState<'authority' | 'member'>('member');
  const [isMigrating, setIsMigrating] = useState(false);

  const handleGenerateNewKey = useCallback(async () => {
    try {
      const key = await generateSyncKey();
      setNewKeyInput(await exportKey(key));
    } catch (error) {
      logger.error(error);
      toast('生成新密钥失败', 'error');
    }
  }, [toast]);

  const handleMigration = useCallback(async () => {
    if (!newKeyInput.trim()) return;

    try {
      setIsMigrating(true);
      const normalized = newKeyInput.trim();
      const isValid = await verifyKey(normalized);
      if (!isValid) {
        toast('无效的密钥格式', 'error');
        return;
      }

      await storeKey(await importKey(normalized));
      const engine = await getSyncEngine();
      if (engine) {
        if (migrationMode === 'authority') {
          await engine.resetSyncState();
          await engine.regenerateOperations();
          void engine.push().catch((error) => logger.error('[Migration] Push failed:', error));
        } else {
          await engine.clearAllData();
          void engine.pull().catch((error) => logger.error('[Migration] Pull failed:', error));
        }
      }

      await checkKey();
      setIsChangeDialogOpen(false);
      setNewKeyInput('');
      setConfirmText('');
      setMigrationMode('member');
      toast(
        migrationMode === 'authority'
          ? '密钥已更换。本地数据已重新加密，正在准备上传...'
          : '密钥已更换。本地数据已清除，正在从服务器拉取最新数据...',
        'success'
      );
      onKeyChange?.(normalized);
    } catch (error) {
      logger.error('Key migration failed:', error);
      toast('更换密钥失败', 'error');
    } finally {
      setIsMigrating(false);
    }
  }, [checkKey, migrationMode, newKeyInput, onKeyChange, toast]);

  return {
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
  };
}
