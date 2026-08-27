import { useCallback, useState } from 'react';
import { getSyncEngine } from '@/db';
import { exportKey, generateSyncKey, importKey, verifyKey } from '@/lib/crypto/encryption';
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

      const engine = await getSyncEngine();
      if (!engine) {
        throw new Error('同步引擎初始化失败');
      }
      await engine.migrateTeamKey(migrationMode, await importKey(normalized));

      await checkKey();
      setIsChangeDialogOpen(false);
      setNewKeyInput('');
      setConfirmText('');
      setMigrationMode('member');
      toast(
        migrationMode === 'authority'
          ? '密钥已更换。本地数据已重新加密并上传。'
          : '密钥已更换。本地数据已清除并从服务器拉取。',
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
