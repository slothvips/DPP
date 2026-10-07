import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { jenkinsBuildTemplateSource } from '@/features/jenkins/buildNotifyTemplate';
import { hasNotifyTeamSync } from '@/features/notify/workerApi';
import { getNotifyConfig, writeJenkinsBuildTemplate } from '@/lib/db/notify';
import { logger } from '@/utils/logger';

export function JenkinsBuildNotifyDialog() {
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const [open, setOpen] = useState(false);
  const [template, setTemplate] = useState(jenkinsBuildTemplateSource(''));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    void getNotifyConfig()
      .then((config) => {
        if (mounted) setTemplate(jenkinsBuildTemplateSource(config?.jenkinsBuildTemplate ?? ''));
      })
      .catch((error: unknown) => {
        logger.error('[Jenkins] 读取构建通知模板失败', error);
        if (mounted) toastRef.current('读取构建通知模板失败', 'error');
      });
    return () => {
      mounted = false;
    };
  }, [open]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (!(await hasNotifyTeamSync())) {
        toast('请先保存同步服务器地址和团队同步密钥', 'error');
        return;
      }
      await writeJenkinsBuildTemplate(template);
      toast('构建通知模板已保存', 'success');
      setOpen(false);
    } catch (error) {
      logger.error('[Jenkins] 保存构建通知模板失败', error);
      toast(error instanceof Error ? error.message : '保存失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 shrink-0 rounded-xl px-3 text-xs"
        onClick={() => setOpen(true)}
      >
        通知模板
      </Button>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>构建通知模板</DialogTitle>
        </DialogHeader>
        <Textarea
          data-testid="jenkins-notify-template"
          value={template}
          disabled={saving}
          rows={16}
          onChange={(event) => setTemplate(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          {
            '可用 {环境} {地址} {任务} {编号} {结果} {触发} {原因} {错误} {开始} {耗时} {节点} {参数} {变更} {产物} {说明} {链接} {标签} {发出者}。{环境} 是 Jenkins 名称，{地址} 是服务器。{发出者} 是发出这条消息的浏览器，显示在「通知发出者」后面。{结果} 会显示成 🟢 成功 这类。{错误} 在成功时显示无，其他结果从日志摘原因，没有原因时也显示无。每一行都会出现，没有内容时显示无。支持粗体、斜体、等宽、链接和引用。日志在同一条消息的附件里。清空后保存会回到默认格式。'
          }
        </p>
        <DialogFooter>
          <Button type="button" disabled={saving} onClick={() => void save()}>
            {saving ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
