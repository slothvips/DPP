import { useEffect, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import type { BuildParameter } from '@/features/jenkins/api/build';
import { JenkinsService } from '@/features/jenkins/service';
import { logger } from '@/utils/logger';

interface UseBuildDialogOptions {
  jobUrl: string;
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

  useEffect(() => {
    const loadParams = async () => {
      try {
        const details = (await JenkinsService.getJobDetails(jobUrl, envId)) as JenkinsJobDetails;
        const definitions = extractBuildParameters(details);
        setParams(definitions);
        setFormValues(buildDefaultFormValues(definitions));
      } catch (error) {
        logger.error(error);
      } finally {
        setLoading(false);
      }
    };

    if (!isOpen) {
      return;
    }

    setLoading(true);
    setParams([]);
    setFormValues({});
    void loadParams();
  }, [envId, isOpen, jobUrl]);

  const updateFormValue = (name: string, value: string | boolean | number) => {
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleBuild = async () => {
    setBuilding(true);
    try {
      const success = await JenkinsService.triggerBuild(jobUrl, formValues, envId);
      if (!success) {
        toast('触发构建失败，请检查网络或权限', 'error');
        return;
      }

      toast('构建已触发！', 'success');
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
