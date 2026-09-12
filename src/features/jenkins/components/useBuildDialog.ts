import { useEffect, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import type { BuildParameter } from '@/features/jenkins/api/build';
import { JenkinsService } from '@/features/jenkins/service';
import { recordRecentAction } from '@/lib/db';
import { useConfirmDialog } from '@/utils/confirm-dialog';
import { logger } from '@/utils/logger';
import { isSensitiveFieldName } from '@/utils/sensitive';

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
  const { confirm } = useConfirmDialog();
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [params, setParams] = useState<BuildParameter[]>([]);
  const [formValues, setFormValues] = useState<Record<string, string | boolean | number>>({});

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let cancelled = false;

    const loadParams = async () => {
      try {
        const details = (await JenkinsService.getJobDetails(jobUrl, envId)) as JenkinsJobDetails;
        if (cancelled) {
          return;
        }

        const definitions = extractBuildParameters(details);
        setParams(definitions);
        setFormValues(buildDefaultFormValues(definitions));
      } catch (error) {
        if (!cancelled) {
          logger.error(error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    setLoading(true);
    setParams([]);
    setFormValues({});
    void loadParams();

    return () => {
      cancelled = true;
    };
  }, [envId, isOpen, jobUrl]);

  const updateFormValue = (name: string, value: string | boolean | number) => {
    setFormValues((prev) => (prev[name] === value ? prev : { ...prev, [name]: value }));
  };

  const handleBuild = async () => {
    const parameterSummary = Object.fromEntries(
      Object.entries(formValues).map(([key, value]) => [
        key,
        isSensitiveFieldName(key) ? '[已隐藏]' : value,
      ])
    );
    const confirmed = await confirm(
      `环境：${envId || '当前环境'}\nJob：${jobName}\n参数：${JSON.stringify(parameterSummary)}`,
      '确认触发构建'
    );
    if (!confirmed) return;

    setBuilding(true);
    try {
      const buildResult = await JenkinsService.triggerBuild({
        jobUrl,
        parameters: formValues,
        envId,
      });
      if (!buildResult.accepted) {
        toast('触发构建失败，请检查网络或权限', 'error');
        return;
      }

      await recordRecentAction({
        type: 'jenkins_build',
        targetId: `${envId || ''}:${jobUrl}`,
        label: jobName,
        jobUrl,
        envId,
      });
      toast(
        buildResult.queueId
          ? `构建已进入队列 (#${buildResult.queueId})`
          : '构建请求已接受，但暂时无法确认队列状态',
        'success'
      );
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
    params,
    updateFormValue,
  };
}
