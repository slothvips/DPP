import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { exportKey } from '@/lib/crypto/encryption';
import {
  clearPersonalKey,
  generateAndStorePersonalKey,
  importAndStorePersonalKey,
  loadPersonalKey,
} from '@/lib/crypto/personalKey';
import { useConfirmDialog } from '@/utils/confirm-dialog';
import { logger } from '@/utils/logger';

export function usePersonalKeyManager() {
  const { toast } = useToast();
  const { confirm } = useConfirmDialog();
  const [hasKey, setHasKey] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [keyString, setKeyString] = useState('');
  const [importInput, setImportInput] = useState('');
  const [replaceInput, setReplaceInput] = useState('');
  const [isReplaceOpen, setIsReplaceOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);

  const checkKey = useCallback(async () => {
    try {
      const key = await loadPersonalKey();
      if (key) {
        setHasKey(true);
        setKeyString(await exportKey(key));
        return;
      }
      setHasKey(false);
      setKeyString('');
    } catch (error) {
      logger.error('Failed to load personal key:', error);
    }
  }, []);

  useEffect(() => {
    void checkKey();
  }, [checkKey]);

  const handleGenerate = useCallback(async () => {
    try {
      setIsGenerating(true);
      await generateAndStorePersonalKey();
      await checkKey();
      toast('个人私钥已生成并保存', 'success');
      setImportInput('');
    } catch (error) {
      logger.error(error);
      toast('生成个人私钥失败', 'error');
    } finally {
      setIsGenerating(false);
    }
  }, [checkKey, toast]);

  const handleImport = useCallback(async () => {
    if (!importInput.trim()) return;

    try {
      setIsImporting(true);
      await importAndStorePersonalKey(importInput);
      await checkKey();
      toast('个人私钥已导入', 'success');
      setImportInput('');
    } catch (error) {
      logger.error(error);
      toast('无效的密钥格式', 'error');
    } finally {
      setIsImporting(false);
    }
  }, [checkKey, importInput, toast]);

  const handleReplace = useCallback(async () => {
    if (!replaceInput.trim()) return;

    const confirmed = await confirm(
      '确定要用新密钥覆盖当前个人私钥吗？\n\n若已有使用旧密钥加密的个人数据，将无法再解密。请确认新密钥已在你的其他设备上妥善备份。',
      '确认更换个人私钥',
      'danger'
    );
    if (!confirmed) return;

    try {
      setIsReplacing(true);
      await importAndStorePersonalKey(replaceInput);
      await checkKey();
      toast('个人私钥已更换', 'success');
      setReplaceInput('');
      setIsReplaceOpen(false);
      setShowKey(false);
    } catch (error) {
      logger.error(error);
      toast('无效的密钥格式', 'error');
    } finally {
      setIsReplacing(false);
    }
  }, [checkKey, confirm, replaceInput, toast]);

  const handleGenerateReplace = useCallback(async () => {
    const confirmed = await confirm(
      '确定要生成新的个人私钥并覆盖当前密钥吗？\n\n旧密钥加密的个人数据将无法再解密。请先备份当前密钥（若仍需要）。',
      '确认生成并替换',
      'danger'
    );
    if (!confirmed) return;

    try {
      setIsReplacing(true);
      await generateAndStorePersonalKey();
      await checkKey();
      toast('已生成并保存新的个人私钥', 'success');
      setReplaceInput('');
      setIsReplaceOpen(false);
      setShowKey(false);
    } catch (error) {
      logger.error(error);
      toast('生成个人私钥失败', 'error');
    } finally {
      setIsReplacing(false);
    }
  }, [checkKey, confirm, toast]);

  const handleClear = useCallback(async () => {
    const confirmed = await confirm(
      '确定要清除个人私钥吗？\n\n清除后将无法解密使用该密钥加密的个人私密数据。请确保已自行备份。',
      '确认清除个人私钥',
      'danger'
    );
    if (!confirmed) return;

    try {
      await clearPersonalKey();
      await checkKey();
      setShowKey(false);
      toast('个人私钥已清除', 'info');
    } catch (error) {
      logger.error(error);
      toast('清除个人私钥失败', 'error');
    }
  }, [checkKey, confirm, toast]);

  const handleCopyKey = useCallback(() => {
    void navigator.clipboard.writeText(keyString).then(
      () => toast('个人私钥已复制到剪贴板', 'success'),
      () => toast('复制失败', 'error')
    );
  }, [keyString, toast]);

  return {
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
  };
}
