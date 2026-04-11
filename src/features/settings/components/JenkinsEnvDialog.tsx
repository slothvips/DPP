import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { JenkinsEnvironment } from '@/db';
import { useJenkinsEnvDialog } from './useJenkinsEnvDialog';

interface JenkinsEnvDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData: JenkinsEnvironment | null;
  existingEnvs: JenkinsEnvironment[];
  currentEnvId: string;
}

export function JenkinsEnvDialog(props: JenkinsEnvDialogProps) {
  const { open, onOpenChange, initialData } = props;
  const { formData, isDetecting, updateField, handleSave, handleAutoDetect } =
    useJenkinsEnvDialog(props);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{initialData ? '编辑环境' : '添加环境'}</DialogTitle>
          <DialogDescription>配置您的 Jenkins 服务器连接信息。</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">名称</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(event) => updateField('name', event.target.value)}
              placeholder="取个名儿区分一下配置信息~"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="host">服务器地址</Label>
            <Input
              id="host"
              value={formData.host}
              onChange={(event) => updateField('host', event.target.value)}
              placeholder="http://jenkins.example.com"
            />
            <Button
              variant="outline"
              className="w-full"
              onClick={handleAutoDetect}
              disabled={isDetecting}
            >
              {isDetecting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  检测中...
                </>
              ) : (
                '自动填充凭证(需已登录 web jenkins)'
              )}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="user">用户 ID</Label>
              <Input
                id="user"
                value={formData.user}
                onChange={(event) => updateField('user', event.target.value)}
                placeholder="admin"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="token">API 令牌</Label>
              <Input
                id="token"
                type="password"
                value={formData.token}
                onChange={(event) => updateField('token', event.target.value)}
                placeholder="••••••••••••"
              />
            </div>
          </div>

          <div className="bg-muted/50 p-3 rounded-md flex items-start gap-2 text-xs text-muted-foreground">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <p>如果您已在其他标签页登录 Jenkins，可以使用自动填充功能快速配置。</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
