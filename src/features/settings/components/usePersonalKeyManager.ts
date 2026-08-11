import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { syncEngine } from '@/db';
import { exportKey } from '@/lib/crypto/encryption';
import {
  clearPersonalKey,
  generateAndStorePersonalKey,
  importAndStorePersonalKey,
  loadPersonalKey,
} from '@/lib/crypto/personalKey';
import {
  finalizePersonalSyncAfterKeyReady,
  resetPersonalSyncBootstrapFlag,
} from '@/lib/sync/personalSyncBootstrap';
import { useConfirmDialog } from '@/utils/confirm-dialog';
import { logger } from '@/utils/logger';

/** 个人私钥写入后：push 本地个人数据，再从服务端重建本地同步数据 */
async function syncAfterPersonalKeyReady(): Promise<number> {
  await syncEngine.getClientId();
  const live = syncEngine.instance;
  if (!live) {
    throw new Error('同步引擎未就绪');
  }
  return finalizePersonalSyncAfterKeyReady(live);
}

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
      setHasKey(Boolean(key));
      if (!key) {
        setKeyString('');
        setShowKey(false);
      }
    } catch (error) {
      logger.error('Failed to load personal key:', error);
    }
  }, []);

  useEffect(() => {
    void checkKey();
  }, [checkKey]);

  const runPostKeySync = useCallback(
    async (successBase: string) => {
      toast('正在推送个人数据并重建本地同步数据...', 'info');
      try {
        const enqueued = await syncAfterPersonalKeyReady();
        await checkKey();
        if (enqueued > 0) {
          toast(`${successBase}；已推送 ${enqueued} 条个人数据并完成本地数据重建`, 'success');
        } else {
          toast(`${successBase}；已完成本地数据重建`, 'success');
        }
      } catch (error) {
        logger.error('Failed to push/rebuild after personal key ready:', error);
        await checkKey();
        toast('个人私钥已保存，但个人数据推送或本地重建失败。请检查同步配置后手动同步。', 'error');
      }
    },
    [checkKey, toast]
  );

  const handleGenerate = useCallback(async () => {
    try {
      setIsGenerating(true);
      await generateAndStorePersonalKey();
      setImportInput('');
      await runPostKeySync('个人私钥已生成并保存');
    } catch (error) {
      logger.error(error);
      toast('生成个人私钥失败', 'error');
    } finally {
      setIsGenerating(false);
    }
  }, [runPostKeySync, toast]);

  const handleImport = useCallback(async () => {
    if (!importInput.trim()) return;

    try {
      setIsImporting(true);
      await importAndStorePersonalKey(importInput);
      setImportInput('');
      await runPostKeySync('个人私钥已导入');
    } catch (error) {
      logger.error(error);
      toast('无效的密钥格式', 'error');
    } finally {
      setIsImporting(false);
    }
  }, [importInput, runPostKeySync, toast]);

  const handleReplace = useCallback(async () => {
    if (!replaceInput.trim()) return;

    const confirmed = await confirm(
      '确定要用新密钥覆盖当前个人私钥吗？\n\n若已有使用旧密钥加密的个人数据，将无法再解密。本地个人数据会先用新密钥推送，再从服务器重建。',
      '确认更换个人私钥',
      'danger'
    );
    if (!confirmed) return;

    try {
      setIsReplacing(true);
      await importAndStorePersonalKey(replaceInput);
      setReplaceInput('');
      setIsReplaceOpen(false);
      setShowKey(false);
      setKeyString('');
      await runPostKeySync('个人私钥已更换');
    } catch (error) {
      logger.error(error);
      toast('无效的密钥格式', 'error');
    } finally {
      setIsReplacing(false);
    }
  }, [confirm, replaceInput, runPostKeySync, toast]);

  const handleGenerateReplace = useCallback(async () => {
    const confirmed = await confirm(
      '确定要生成新的个人私钥并覆盖当前密钥吗？\n\n旧密钥加密的云端个人数据将无法再解密。本地个人数据会先用新密钥推送，再从服务器重建。',
      '确认生成并替换',
      'danger'
    );
    if (!confirmed) return;

    try {
      setIsReplacing(true);
      await generateAndStorePersonalKey();
      setReplaceInput('');
      setIsReplaceOpen(false);
      setShowKey(false);
      setKeyString('');
      await runPostKeySync('已生成并保存新的个人私钥');
    } catch (error) {
      logger.error(error);
      toast('生成个人私钥失败', 'error');
    } finally {
      setIsReplacing(false);
    }
  }, [confirm, runPostKeySync, toast]);

  const handleClear = useCallback(async () => {
    const confirmed = await confirm(
      '确定要清除个人私钥吗？\n\n清除后将无法解密使用该密钥加密的个人私密数据，验证器等个人数据也将停止上传。请确保已自行备份。',
      '确认清除个人私钥',
      'danger'
    );
    if (!confirmed) return;

    try {
      await clearPersonalKey();
      await resetPersonalSyncBootstrapFlag();
      await checkKey();
      setShowKey(false);
      setKeyString('');
      toast('个人私钥已清除', 'info');
    } catch (error) {
      logger.error(error);
      toast('清除个人私钥失败', 'error');
    }
  }, [checkKey, confirm, toast]);

  const handleToggleShowKey = useCallback(async () => {
    if (showKey) {
      setShowKey(false);
      setKeyString('');
      return;
    }

    try {
      const key = await loadPersonalKey();
      if (!key) {
        setHasKey(false);
        toast('个人私钥不存在', 'error');
        return;
      }
      setKeyString(await exportKey(key));
      setShowKey(true);
    } catch (error) {
      logger.error('Failed to reveal personal key:', error);
      toast('无法显示个人私钥', 'error');
    }
  }, [showKey, toast]);

  const handleCopyKey = useCallback(() => {
    void (async () => {
      try {
        let value = keyString;
        if (!value) {
          const key = await loadPersonalKey();
          if (!key) {
            toast('个人私钥不存在', 'error');
            return;
          }
          value = await exportKey(key);
        }
        await navigator.clipboard.writeText(value);
        toast('个人私钥已复制到剪贴板', 'success');
      } catch {
        toast('复制失败', 'error');
      }
    })();
  }, [keyString, toast]);

  return {
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
    setShowKey,
    showKey,
  };
}
