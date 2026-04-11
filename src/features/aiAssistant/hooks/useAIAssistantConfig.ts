import { useCallback, useEffect, useState } from 'react';
import { isAIConfigConfigured } from '../lib/aiConfigStorage';

interface UseAIAssistantConfigOptions {
  resetProvider: () => void;
}

export function useAIAssistantConfig({ resetProvider }: UseAIAssistantConfigOptions) {
  const [isConfigMissing, setIsConfigMissing] = useState(false);
  const [presetPrompt, setPresetPrompt] = useState('');

  useEffect(() => {
    isAIConfigConfigured().then((configured) => {
      setIsConfigMissing(!configured);
    });

    const checkPreset = async () => {
      try {
        const result = await browser.storage.session.get('dpp_ai_preset_prompt');
        const preset = result?.dpp_ai_preset_prompt as string | undefined;
        if (preset) {
          setPresetPrompt(preset);
          await browser.storage.session.remove('dpp_ai_preset_prompt');
          return;
        }
      } catch {
        // storage.session not available, try localStorage
      }

      const localPreset = localStorage.getItem('dpp_ai_preset_prompt');
      if (localPreset) {
        setPresetPrompt(localPreset);
        localStorage.removeItem('dpp_ai_preset_prompt');
      }
    };

    void checkPreset();
  }, []);

  const handleConfigSaved = useCallback(() => {
    setIsConfigMissing(false);
    resetProvider();
  }, [resetProvider]);

  const ensureConfigReady = useCallback(async () => {
    const configured = await isAIConfigConfigured();
    if (!configured) {
      setIsConfigMissing(true);
      return false;
    }

    return true;
  }, []);

  return {
    isConfigMissing,
    presetPrompt,
    handleConfigSaved,
    ensureConfigReady,
  };
}
