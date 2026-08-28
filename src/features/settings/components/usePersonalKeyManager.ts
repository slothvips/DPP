import { useCallback, useEffect, useRef, useState } from 'react';
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
  type PersonalKeyFinalizeStep,
  finalizePersonalSyncAfterKeyReady,
  resetPersonalSyncBootstrapFlag,
} from '@/lib/sync/personalSyncBootstrap';
import { hasConfiguredSyncServer } from '@/lib/sync/syncServerConfig';
import { useConfirmDialog } from '@/utils/confirm-dialog';
import { logger } from '@/utils/logger';
import type {
  PersonalKeySetupProgressState,
  PersonalKeySetupStepId,
} from './personalKeySetupSteps';

/** 个人私钥写入后，上传本地数据并拉取远端个人数据。 */
async function syncAfterPersonalKeyReady(
  onStep: (step: PersonalKeyFinalizeStep) => void
): Promise<number> {
  await syncEngine.getClientId();
  const live = syncEngine.instance;
  if (!live) {
    throw new Error('同步引擎未就绪');
  }
  return finalizePersonalSyncAfterKeyReady(live, onStep);
}

async function assertSyncServerConfigured(): Promise<void> {
  if (!(await hasConfiguredSyncServer())) {
    throw new Error('请先配置并保存同步服务器地址，再配置个人私钥');
  }
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
  const [isCustodyGuideOpen, setIsCustodyGuideOpen] = useState(false);
  const [custodyGuideKey, setCustodyGuideKey] = useState('');
  const [setupProgress, setSetupProgress] = useState<PersonalKeySetupProgressState | null>(null);
  const activeStepRef = useRef<PersonalKeySetupStepId>('saving');
  const doneDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearDoneDismissTimer = useCallback(() => {
    if (doneDismissTimerRef.current !== null) {
      clearTimeout(doneDismissTimerRef.current);
      doneDismissTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearDoneDismissTimer();
    };
  }, [clearDoneDismissTimer]);

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

  const openCustodyGuide = useCallback(async () => {
    try {
      const key = await loadPersonalKey();
      if (!key) {
        setCustodyGuideKey('');
        setIsCustodyGuideOpen(true);
        return;
      }
      const exported = await exportKey(key);
      setCustodyGuideKey(exported);
      setKeyString(exported);
      setShowKey(true);
      setIsCustodyGuideOpen(true);
    } catch (error) {
      logger.error('Failed to prepare personal key custody guide:', error);
      setCustodyGuideKey('');
      setIsCustodyGuideOpen(true);
    }
  }, []);

  const dismissSetupProgress = useCallback(() => {
    clearDoneDismissTimer();
    setSetupProgress(null);
  }, [clearDoneDismissTimer]);

  const runPostKeySync = useCallback(async () => {
    clearDoneDismissTimer();
    activeStepRef.current = 'enqueue';
    setSetupProgress({ phase: 'enqueue' });

    try {
      const enqueued = await syncAfterPersonalKeyReady((step) => {
        activeStepRef.current = step;
        setSetupProgress({ phase: step });
      });
      await checkKey();
      setSetupProgress({ phase: 'done', enqueued });
      await openCustodyGuide();
      doneDismissTimerRef.current = setTimeout(() => {
        setSetupProgress((current) => (current?.phase === 'done' ? null : current));
        doneDismissTimerRef.current = null;
      }, 4000);
    } catch (error) {
      logger.error('Failed to sync after personal key ready:', error);
      await checkKey();
      setSetupProgress({
        phase: 'error',
        failedStep: activeStepRef.current,
        errorMessage: '个人私钥已保存，但后续同步失败。请检查同步配置后手动同步。',
      });
    }
  }, [checkKey, clearDoneDismissTimer, openCustodyGuide]);

  const handleGenerate = useCallback(async () => {
    try {
      await assertSyncServerConfigured();
      setIsGenerating(true);
      clearDoneDismissTimer();
      activeStepRef.current = 'saving';
      setSetupProgress({ phase: 'saving' });
      await generateAndStorePersonalKey();
      setImportInput('');
      await checkKey();
      await runPostKeySync();
    } catch (error) {
      logger.error(error);
      setSetupProgress(null);
      const message =
        error instanceof Error && error.message.includes('同步服务器')
          ? error.message
          : '生成个人私钥失败';
      toast(message, 'error');
    } finally {
      setIsGenerating(false);
    }
  }, [checkKey, clearDoneDismissTimer, runPostKeySync, toast]);

  const handleImport = useCallback(async () => {
    if (!importInput.trim()) return;

    try {
      await assertSyncServerConfigured();
      setIsImporting(true);
      clearDoneDismissTimer();
      activeStepRef.current = 'saving';
      setSetupProgress({ phase: 'saving' });
      await importAndStorePersonalKey(importInput);
      setImportInput('');
      await checkKey();
      await runPostKeySync();
    } catch (error) {
      logger.error(error);
      setSetupProgress(null);
      const message =
        error instanceof Error && error.message.includes('同步服务器')
          ? error.message
          : '无效的私钥格式';
      toast(message, 'error');
    } finally {
      setIsImporting(false);
    }
  }, [checkKey, clearDoneDismissTimer, importInput, runPostKeySync, toast]);

  const handleReplace = useCallback(async () => {
    if (!replaceInput.trim()) return;

    try {
      await assertSyncServerConfigured();
    } catch (error) {
      toast(error instanceof Error ? error.message : '请先配置同步服务器', 'error');
      return;
    }

    const confirmed = await confirm(
      '确定要用新私钥覆盖当前个人私钥吗？\n\n若已有使用旧私钥加密的个人数据，将无法再解密。本地个人数据会使用新私钥重新推送。',
      '确认更换个人私钥',
      'danger'
    );
    if (!confirmed) return;

    try {
      setIsReplacing(true);
      clearDoneDismissTimer();
      activeStepRef.current = 'saving';
      setSetupProgress({ phase: 'saving' });
      await importAndStorePersonalKey(replaceInput);
      setReplaceInput('');
      setIsReplaceOpen(false);
      setShowKey(false);
      setKeyString('');
      await checkKey();
      await runPostKeySync();
    } catch (error) {
      logger.error(error);
      setSetupProgress(null);
      toast('无效的私钥格式', 'error');
    } finally {
      setIsReplacing(false);
    }
  }, [checkKey, clearDoneDismissTimer, confirm, replaceInput, runPostKeySync, toast]);

  const handleGenerateReplace = useCallback(async () => {
    try {
      await assertSyncServerConfigured();
    } catch (error) {
      toast(error instanceof Error ? error.message : '请先配置同步服务器', 'error');
      return;
    }

    const confirmed = await confirm(
      '确定要生成新的个人私钥并覆盖当前私钥吗？\n\n旧私钥加密的云端个人数据将无法再解密。本地个人数据会使用新私钥重新推送。',
      '确认生成并替换',
      'danger'
    );
    if (!confirmed) return;

    try {
      setIsReplacing(true);
      clearDoneDismissTimer();
      activeStepRef.current = 'saving';
      setSetupProgress({ phase: 'saving' });
      await generateAndStorePersonalKey();
      setReplaceInput('');
      setIsReplaceOpen(false);
      setShowKey(false);
      setKeyString('');
      await checkKey();
      await runPostKeySync();
    } catch (error) {
      logger.error(error);
      setSetupProgress(null);
      toast('生成个人私钥失败', 'error');
    } finally {
      setIsReplacing(false);
    }
  }, [checkKey, clearDoneDismissTimer, confirm, runPostKeySync, toast]);

  const handleClear = useCallback(async () => {
    const confirmed = await confirm(
      '确定要清除个人私钥吗？\n\n清除后将无法解密使用该私钥加密的个人私密数据，验证器等个人数据也将停止上传。请确保已自行备份。',
      '确认清除个人私钥',
      'danger'
    );
    if (!confirmed) return;

    try {
      clearDoneDismissTimer();
      setSetupProgress(null);
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
  }, [checkKey, clearDoneDismissTimer, confirm, toast]);

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

  const handleCustodyGuideOpenChange = useCallback((open: boolean) => {
    setIsCustodyGuideOpen(open);
    if (!open) {
      setCustodyGuideKey('');
    }
  }, []);

  const isSetupRunning =
    setupProgress !== null && setupProgress.phase !== 'done' && setupProgress.phase !== 'error';

  return {
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
    setShowKey,
    setupProgress,
    showKey,
  };
}
