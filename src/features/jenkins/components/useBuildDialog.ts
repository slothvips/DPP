import { useEffect, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import type { BuildParameter } from '@/features/jenkins/api/build';
import { JenkinsService } from '@/features/jenkins/service';
import {
  isJenkinsReleaseBuild,
  isJenkinsTelegramConfigured,
  loadJenkinsTelegramConfig,
} from '@/features/jenkins/telegram';
import { logger } from '@/utils/logger';

interface UseBuildDialogOptions {
  jobUrl: string;
  jobName: string;
  envId?: string;
  isOpen: boolean;
  onClose: () => void;
  onBuildSuccess?: () => void;
}

interface JenkinsJobDetails {
  property?: { _class: string; parameterDefinitions?: BuildParameter[] }[];
  actions?: { _class: string; parameterDefinitions?: BuildParameter[] }[];
}

function extractBuildParameters(details: JenkinsJobDetails): BuildParameter[] {
  const property = details.property?.find(
    (item) => item._class === 'hudson.model.ParametersDefinitionProperty'
  );
  if (property?.parameterDefinitions) {
    return property.parameterDefinitions;
  }

  const action = details.actions?.find(
    (item) => item._class === 'hudson.model.ParametersDefinitionProperty'
  );
  return action?.parameterDefinitions || [];
}

function buildDefaultFormValues(parameters: BuildParameter[]) {
  const defaults: Record<string, string | boolean | number> = {};
  for (const parameter of parameters) {
    if (parameter.defaultParameterValue?.value !== undefined) {
      defaults[parameter.name] = parameter.defaultParameterValue.value;
    }
  }
  return defaults;
}

export function useBuildDialog({
  jobUrl,
  jobName,
  envId,
  isOpen,
  onClose,
  onBuildSuccess,
}: UseBuildDialogOptions) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [params, setParams] = useState<BuildParameter[]>([]);
  const [formValues, setFormValues] = useState<Record<string, string | boolean | number>>({});
  const [telegramAvailable, setTelegramAvailable] = useState(false);
  const [notifyTelegram, setNotifyTelegram] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let cancelled = false;

    const loadParams = async () => {
      const [detailsResult, telegramConfigResult] = await Promise.allSettled([
        JenkinsService.getJobDetails(jobUrl, envId),
        loadJenkinsTelegramConfig(),
      ]);

      if (cancelled) {
        return;
      }

      let definitions: BuildParameter[] = [];
      if (detailsResult.status === 'fulfilled') {
        definitions = extractBuildParameters(detailsResult.value as JenkinsJobDetails);
      } else {
        logger.error(detailsResult.reason);
      }

      const defaults = buildDefaultFormValues(definitions);
      setParams(definitions);
      setFormValues(defaults);
      setLoading(false);

      if (telegramConfigResult.status === 'fulfilled') {
        const config = telegramConfigResult.value;
        const available = isJenkinsTelegramConfigured(config);
        setTelegramAvailable(available);
        setNotifyTelegram(
          available &&
            isJenkinsReleaseBuild({ jobName, jobUrl, parameters: defaults }, config.releaseKeywords)
        );
      } else {
        logger.error(
          '[Jenkins] Failed to load Telegram notification config:',
          telegramConfigResult.reason
        );
        setTelegramAvailable(false);
        setNotifyTelegram(false);
      }
    };

    setLoading(true);
    setParams([]);
    setFormValues({});
    setTelegramAvailable(false);
    setNotifyTelegram(false);
    void loadParams();

    return () => {
      cancelled = true;
    };
  }, [envId, isOpen, jobName, jobUrl]);

  const updateFormValue = (name: string, value: string | boolean | number) => {
    setFormValues((prev) => (prev[name] === value ? prev : { ...prev, [name]: value }));
  };

  const handleBuild = async () => {
    setBuilding(true);
    try {
      const result = await JenkinsService.triggerBuild({
        jobUrl,
        jobName,
        parameters: formValues,
        envId,
        notifyTelegram,
      });
      if (!result.buildTriggered) {
        toast('触发构建失败，请检查网络或权限', 'error');
        return;
      }

      if (result.telegramNotification?.attempted && !result.telegramNotification.sent) {
        toast('构建已触发，但 TG 通知发送失败', 'error');
      } else if (result.telegramNotification?.sent) {
        toast('构建已触发，TG 通知已发送', 'success');
      } else {
        toast('构建已触发！', 'success');
      }

      onClose();
      onBuildSuccess?.();
    } catch (error) {
      logger.error(error);
      toast('构建出错', 'error');
    } finally {
      setBuilding(false);
    }
  };

  return {
    building,
    formValues,
    handleBuild,
    loading,
    notifyTelegram,
    params,
    setNotifyTelegram,
    telegramAvailable,
    updateFormValue,
  };
}
