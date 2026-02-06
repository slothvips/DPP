import { useLiveQuery } from 'dexie-react-hooks';
import { AlertCircle, Check, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
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
import { useToast } from '@/components/ui/toast';
import { type JenkinsEnvironment, db } from '@/db';
import { http } from '@/lib/http';
import { cn } from '@/utils/cn';
import { logger } from '@/utils/logger';
import { VALIDATION_LIMITS, validateLength } from '@/utils/validation';

export function JenkinsEnvManager() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEnv, setEditingEnv] = useState<JenkinsEnvironment | null>(null);

  const environments = useLiveQuery(async () => {
    const setting = await db.settings.get('jenkins_environments');
    return (setting?.value as JenkinsEnvironment[]) || [];
  }, []);

  const currentEnvId = useLiveQuery(async () => {
    const setting = await db.settings.get('jenkins_current_env');
    return (setting?.value as string) || '';
  });

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此环境吗？')) return;

    try {
      const newEnvs = environments?.filter((e) => e.id !== id) || [];
      await db.settings.put({ key: 'jenkins_environments', value: newEnvs });

      await Promise.all([
        db.jobs.where('env').equals(id).delete(),
        db.myBuilds.where('env').equals(id).delete(),
        db.othersBuilds.where('env').equals(id).delete(),
      ]);

      // If we deleted the current env, switch to another one or clear it
      if (currentEnvId === id) {
        const nextEnv = newEnvs[0];
        await db.settings.put({
          key: 'jenkins_current_env',
          value: nextEnv ? nextEnv.id : '',
        });
      }

      toast('环境已删除', 'success');
    } catch (e) {
      logger.error(e);
      toast('删除环境失败', 'error');
    }
  };

  const handleEdit = (env: JenkinsEnvironment) => {
    setEditingEnv(env);
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingEnv(null);
    setIsDialogOpen(true);
  };

  const handleSetCurrent = async (id: string) => {
    try {
      await db.settings.put({ key: 'jenkins_current_env', value: id });
      toast('已切换当前环境', 'success');
    } catch (e) {
      logger.error(e);
      toast('切换环境失败', 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">环境列表</h3>
        <Button size="sm" onClick={handleAdd} className="gap-2">
          <Plus className="w-4 h-4" /> 新增环境
        </Button>
      </div>

      <div className="grid gap-4">
        {environments?.length === 0 && (
          <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
            暂无 Jenkins 环境配置。
            <br />
            请添加一个环境以开始使用。
          </div>
        )}

        {environments?.map((env) => (
          <div
            key={env.id}
            className={cn(
              'flex items-center justify-between p-4 rounded-lg border transition-colors',
              currentEnvId === env.id
                ? 'border-primary/50 bg-primary/5 dark:bg-primary/10'
                : 'bg-card hover:bg-accent/50'
            )}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{env.name}</span>
                {currentEnvId === env.id && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                    <Check className="w-3 h-3" /> 当前使用
                  </span>
                )}
              </div>
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <span className="truncate max-w-[200px]">{env.host}</span>
                <span>•</span>
                <span>{env.user || '匿名用户'}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {currentEnvId !== env.id && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-primary/30 text-primary hover:bg-primary/5 hover:text-primary hover:border-primary/60"
                  onClick={() => handleSetCurrent(env.id)}
                  title="设为当前"
                >
                  设为当前
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => handleEdit(env)} title="编辑">
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive"
                onClick={() => handleDelete(env.id)}
                title="删除"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <EnvDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        initialData={editingEnv}
        existingEnvs={environments || []}
      />
    </div>
  );
}

interface EnvDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData: JenkinsEnvironment | null;
  existingEnvs: JenkinsEnvironment[];
}

function EnvDialog({ open, onOpenChange, initialData, existingEnvs }: EnvDialogProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Partial<JenkinsEnvironment>>({
    name: '',
    host: '',
    user: '',
    token: '',
  });
  const [isDetecting, setIsDetecting] = useState(false);

  React.useEffect(() => {
    if (open) {
      if (initialData) {
        setFormData(initialData);
      } else {
        setFormData({ name: '', host: '', user: '', token: '' });
      }
    }
  }, [open, initialData]);

  const validate = () => {
    if (!formData.name?.trim()) return '名称不能为空';
    if (!formData.host?.trim()) return '服务器地址不能为空';

    // Check name uniqueness (exclude current item if editing)
    const isNameDuplicate = existingEnvs.some(
      (e) => e.name === formData.name && e.id !== initialData?.id
    );
    if (isNameDuplicate) return '环境名称必须唯一';

    const hostValidation = validateLength(
      formData.host,
      VALIDATION_LIMITS.JENKINS_HOST_MAX,
      'Host'
    );
    if (!hostValidation.valid) return hostValidation.error;

    return null;
  };

  const handleSave = async () => {
    const error = validate();
    if (error) {
      toast(error, 'error');
      return;
    }

    try {
      const newEnv: JenkinsEnvironment = {
        id: initialData?.id || crypto.randomUUID(),
        name: (formData.name || '').trim(),
        host: (formData.host || '').trim(),
        user: formData.user?.trim() || '',
        token: formData.token?.trim() || '',
        order: initialData?.order ?? existingEnvs.length,
      };

      let newEnvs: JenkinsEnvironment[];

      if (initialData) {
        newEnvs = existingEnvs.map((e) => (e.id === initialData.id ? newEnv : e));
      } else {
        newEnvs = [...existingEnvs, newEnv];
      }

      await db.settings.put({ key: 'jenkins_environments', value: newEnvs });

      // If this is the first environment, make it active
      if (existingEnvs.length === 0) {
        await db.settings.put({ key: 'jenkins_current_env', value: newEnv.id });
      }

      toast(initialData ? '环境已更新' : '环境已添加', 'success');
      onOpenChange(false);
    } catch (e) {
      logger.error(e);
      toast('保存环境失败', 'error');
    }
  };

  const runAutoDetect = async () => {
    let url = formData.host;
    if (!url) {
      toast('请先输入服务器地址', 'error');
      return;
    }

    if (!url.startsWith('http')) {
      url = `http://${url}`;
      setFormData((prev) => ({ ...prev, host: url }));
    }
    url = url.replace(/\/$/, '');

    setIsDetecting(true);
    try {
      // 1. Check Login & Get User ID
      const userRes = await http(`${url}/me/api/json?tree=id`, { timeout: 15000 });

      if (userRes.status === 403 || userRes.status === 401) {
        if (confirm('需要认证。是否打开 Jenkins 登录页面？')) {
          window.open(url, '_blank');
        }
        return;
      }

      if (!userRes.ok) throw new Error(`连接失败 (${userRes.status})`);

      const userData = (await userRes.json()) as { id?: string };
      const userId = userData.id;

      if (userId === 'anonymous') {
        if (confirm('当前为“匿名”登录。是否打开 Jenkins 登录页面？')) {
          window.open(`${url}/login`, '_blank');
        }
        return;
      }

      // 2. Get CSRF Crumb
      let crumbHeader = 'Jenkins-Crumb';
      let crumbValue = '';
      try {
        const crumbRes = await http(`${url}/crumbIssuer/api/json`, { timeout: 10000 });
        if (crumbRes.ok) {
          const crumbData = await crumbRes.json();
          crumbHeader = crumbData.crumbRequestField || 'Jenkins-Crumb';
          crumbValue = crumbData.crumb || '';
        }
      } catch {
        logger.warn('Could not fetch crumb, trying without...');
      }

      // 3. Generate Token
      const generateUrl = `${url}/user/${userId}/descriptorByName/jenkins.security.ApiTokenProperty/generateNewToken`;
      const params = new URLSearchParams();
      params.append('newTokenName', `DPP Extension ${new Date().toISOString().slice(0, 10)}`);

      const headers: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      };
      if (crumbValue) headers[crumbHeader] = crumbValue;

      const genRes = await http(generateUrl, {
        method: 'POST',
        headers,
        body: params,
        timeout: 15000,
      });

      if (!genRes.ok) throw new Error(`令牌生成失败: ${genRes.status}`);

      const genData = await genRes.json();
      if (genData.status !== 'ok' || !genData.data?.tokenValue) {
        throw new Error('Jenkins 响应无效');
      }

      const token = genData.data.tokenValue;

      setFormData((prev) => ({
        ...prev,
        host: url,
        user: userId,
        token: token,
        // Auto-fill name if empty
        name: prev.name || (userId ? `${userId} @ ${new URL(url).hostname}` : 'New Env'),
      }));

      toast(`已连接为 ${userId}. 令牌已生成。`, 'success');
    } catch (e) {
      logger.error(e);
      toast(`自动检测失败: ${e instanceof Error ? e.message : String(e)}`, 'error');
    } finally {
      setIsDetecting(false);
    }
  };

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
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="例如：生产环境、测试环境..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="host">服务器地址</Label>
            <Input
              id="host"
              value={formData.host}
              onChange={(e) => setFormData({ ...formData, host: e.target.value })}
              placeholder="http://jenkins.example.com"
            />
            <Button
              variant="outline"
              className="w-full"
              onClick={runAutoDetect}
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
                onChange={(e) => setFormData({ ...formData, user: e.target.value })}
                placeholder="admin"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="token">API 令牌</Label>
              <Input
                id="token"
                type="password"
                value={formData.token}
                onChange={(e) => setFormData({ ...formData, token: e.target.value })}
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
