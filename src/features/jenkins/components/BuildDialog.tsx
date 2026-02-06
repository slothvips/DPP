import { Loader2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import type { BuildParameter } from '@/features/jenkins/api/build';
import { JenkinsService } from '@/features/jenkins/service';
import { logger } from '@/utils/logger';
import { VALIDATION_LIMITS } from '@/utils/validation';

interface Props {
  jobUrl: string;
  jobName: string;
  envId?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function BuildDialog({ jobUrl, jobName, envId, isOpen, onClose }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [params, setParams] = useState<BuildParameter[]>([]);
  const [formValues, setFormValues] = useState<Record<string, string | boolean | number>>({});

  useEffect(() => {
    const loadParams = async () => {
      try {
        const details = (await JenkinsService.getJobDetails(jobUrl, envId)) as {
          property?: { _class: string; parameterDefinitions?: BuildParameter[] }[];
          actions?: { _class: string; parameterDefinitions?: BuildParameter[] }[];
        };

        // Jenkins parameters can be in 'property' (Pipeline) or 'actions' (Freestyle)
        let property = details.property?.find(
          (p: { _class: string; parameterDefinitions?: BuildParameter[] }) =>
            p._class === 'hudson.model.ParametersDefinitionProperty'
        );

        if (!property && details.actions) {
          property = details.actions.find(
            (a: { _class: string; parameterDefinitions?: BuildParameter[] }) =>
              a._class === 'hudson.model.ParametersDefinitionProperty'
          );
        }

        if (property?.parameterDefinitions) {
          const definitions = property.parameterDefinitions;
          setParams(definitions);

          // Initialize default values
          const defaults: Record<string, string | boolean | number> = {};
          for (const p of definitions) {
            if (p.defaultParameterValue?.value !== undefined) {
              defaults[p.name] = p.defaultParameterValue.value;
            }
          }
          setFormValues(defaults);
        }
      } catch (e) {
        logger.error(e);
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      setLoading(true);
      setParams([]);
      setFormValues({});
      loadParams();
    }
  }, [isOpen, jobUrl, envId]);

  const handleBuild = async () => {
    setBuilding(true);
    try {
      const success = await JenkinsService.triggerBuild(jobUrl, formValues, envId);
      if (success) {
        toast('构建已触发！', 'success');
        onClose();
      } else {
        toast('触发构建失败，请检查网络或权限', 'error');
      }
    } catch (e) {
      logger.error(e);
      toast('构建出错', 'error');
    } finally {
      setBuilding(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] max-h-[80vh] overflow-y-auto bg-background text-foreground border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">构建 {jobName}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            配置构建参数并开始任务。
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : params.length === 0 ? (
          <div className="py-4 text-center text-muted-foreground">
            此任务没有参数，可以直接构建。
          </div>
        ) : (
          <div className="grid gap-4 py-4">
            {params.map((p) => (
              <div key={p.name} className="grid w-full items-center gap-1.5">
                <Label htmlFor={p.name}>{p.name}</Label>
                {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}

                {p.type === 'BooleanParameterDefinition' ? (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={p.name}
                      checked={formValues[p.name] === true}
                      onCheckedChange={(checked) =>
                        setFormValues((prev) => ({ ...prev, [p.name]: checked === true }))
                      }
                    />
                    <label
                      htmlFor={p.name}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      启用
                    </label>
                  </div>
                ) : p.type === 'ChoiceParameterDefinition' ? (
                  <Select
                    value={String(formValues[p.name] ?? '')}
                    onValueChange={(val) => setFormValues((prev) => ({ ...prev, [p.name]: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {p.choices?.map((c: string) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="relative">
                    <Textarea
                      id={p.name}
                      value={String(formValues[p.name] || '')}
                      onChange={(e) =>
                        setFormValues((prev) => ({ ...prev, [p.name]: e.target.value }))
                      }
                      className="font-mono text-xs"
                      rows={5}
                      maxLength={VALIDATION_LIMITS.JENKINS_BUILD_PARAM_MAX}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {String(formValues[p.name] || '').length} /{' '}
                      {VALIDATION_LIMITS.JENKINS_BUILD_PARAM_MAX}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={handleBuild}
            disabled={building || loading}
            className="bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-500"
          >
            {building && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            开始构建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
