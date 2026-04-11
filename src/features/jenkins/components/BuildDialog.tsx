import { Loader2 } from 'lucide-react';
import React from 'react';
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
import { VALIDATION_LIMITS } from '@/utils/validation';
import { useBuildDialog } from './useBuildDialog';

interface Props {
  jobUrl: string;
  jobName: string;
  envId?: string;
  isOpen: boolean;
  onClose: () => void;
  onBuildSuccess?: () => void;
}

export function BuildDialog({ jobUrl, jobName, envId, isOpen, onClose, onBuildSuccess }: Props) {
  const { building, formValues, handleBuild, loading, params, updateFormValue } = useBuildDialog({
    jobUrl,
    envId,
    isOpen,
    onClose,
    onBuildSuccess,
  });

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
                      onCheckedChange={(checked) => updateFormValue(p.name, checked === true)}
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
                    onValueChange={(val) => updateFormValue(p.name, val)}
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
                      onChange={(e) => updateFormValue(p.name, e.target.value)}
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
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {building && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            开始构建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
