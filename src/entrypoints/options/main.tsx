import { Download, Github, Upload } from 'lucide-react';
import 'virtual:uno.css';
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeToggle } from '@/components/ThemeToggle';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToastProvider, useToast } from '@/components/ui/toast';
import { db } from '@/db';
import { JenkinsEnvManager } from '@/features/settings/components/JenkinsEnvManager';
import { SyncKeyManager } from '@/features/settings/components/SyncKeyManager';
import { useTheme } from '@/hooks/useTheme';
import { ConfirmDialogProvider, useConfirmDialog } from '@/utils/confirm-dialog';
import { logger } from '@/utils/logger';
import { VALIDATION_LIMITS, validateLength } from '@/utils/validation';
import '@unocss/reset/tailwind.css';

const EXCLUDED_SETTINGS = [
  'sync_client_id',
  'last_sync_time',
  'last_sync_status',
  'last_global_sync',
  'global_sync_status',
  'global_sync_error',
  'global_sync_start_time',
];

// Settings categories for granular export/import
const SETTINGS_CATEGORIES = [
  {
    key: 'theme',
    label: '主题设置',
    description: '深色/浅色主题',
    keys: ['theme'],
  },
  {
    key: 'feature_toggles',
    label: '功能开关',
    description: '热点、链接等功能开关',
    keys: ['feature_hotnews_enabled', 'feature_links_enabled'],
  },
  {
    key: 'jenkins_envs',
    label: 'Jenkins 环境',
    description: 'Jenkins 服务器配置',
    keys: ['jenkins_environments', 'jenkins_current_env'],
  },
  {
    key: 'sync_settings',
    label: '同步设置',
    description: '服务器地址、访问令牌、加密密钥',
    keys: ['custom_server_url', 'sync_access_token', 'sync_encryption_key'],
  },
  {
    key: 'display_prefs',
    label: '显示偏好',
    description: '其他显示相关设置',
    keys: ['show_others_builds'],
  },
];

function OptionsApp() {
  useTheme();
  const { toast } = useToast();
  const { confirm } = useConfirmDialog();
  const [customConfig, setCustomConfig] = useState({ serverUrl: '' });
  const [accessToken, setAccessToken] = useState('');
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [featureToggles, setFeatureToggles] = useState({
    hotNews: true,
    links: true,
  });

  // Export state
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    SETTINGS_CATEGORIES.map((c) => c.key)
  );

  // Load existing config
  useEffect(() => {
    (async () => {
      // General Settings
      const settings = await db.settings.toArray();

      const lastSync = settings.find((s) => s.key === 'last_sync_time')?.value as number;
      if (lastSync) setLastSyncTime(lastSync);

      setCustomConfig({
        serverUrl: (settings.find((s) => s.key === 'custom_server_url')?.value as string) || '',
      });

      setAccessToken((settings.find((s) => s.key === 'sync_access_token')?.value as string) || '');

      // Feature toggles (default to true if not set)
      const hotNewsEnabled = settings.find((s) => s.key === 'feature_hotnews_enabled');
      const linksEnabled = settings.find((s) => s.key === 'feature_links_enabled');
      setFeatureToggles({
        hotNews: hotNewsEnabled?.value !== false,
        links: linksEnabled?.value !== false,
      });
    })();
  }, []);

  const saveDataSourceConfig = async () => {
    // 验证服务器URL长度
    const urlValidation = validateLength(
      customConfig.serverUrl,
      VALIDATION_LIMITS.SYNC_SERVER_URL_MAX,
      '服务器地址'
    );
    if (!urlValidation.valid) {
      toast(urlValidation.error ?? '服务器地址长度超出限制', 'error');
      return;
    }

    // 验证访问令牌长度
    const tokenValidation = validateLength(
      accessToken,
      VALIDATION_LIMITS.SYNC_ACCESS_TOKEN_MAX,
      '访问令牌'
    );
    if (!tokenValidation.valid) {
      toast(tokenValidation.error ?? '访问令牌长度超出限制', 'error');
      return;
    }

    try {
      await db.settings.put({ key: 'custom_server_url', value: customConfig.serverUrl });
      await db.settings.put({ key: 'sync_access_token', value: accessToken });

      toast('配置已保存', 'success');
    } catch (e) {
      logger.error(e);
      toast('保存失败', 'error');
    }
  };

  const handleExport = async () => {
    if (selectedCategories.length === 0) {
      toast('请至少选择一种设置类型', 'error');
      return;
    }

    try {
      const allSettings = await db.settings.toArray();
      const safeSettings = allSettings.filter((s) => !EXCLUDED_SETTINGS.includes(s.key));

      // Filter by selected categories
      const allowedKeys = new Set(
        SETTINGS_CATEGORIES.filter((c) => selectedCategories.includes(c.key)).flatMap((c) => c.keys)
      );
      const filteredSettings = safeSettings.filter((s) => allowedKeys.has(s.key));

      // Check for encryption key in settings
      const hasEncryptionKey = filteredSettings.some((s) => s.key === 'sync_encryption_key');

      if (hasEncryptionKey) {
        const confirmed = await confirm(
          '安全提示：\n\n导出文件中将包含您的【同步加密密钥】。\n\n请务必妥善保管导出文件，不要分享给不可信的人，否则可能导致您的加密数据泄露。\n\n是否继续？',
          '确认导出'
        );
        if (!confirmed) {
          setShowExportDialog(false);
          return;
        }
      }

      const exportObj = {
        version: '1.3',
        exportDate: new Date().toISOString(),
        data: {
          settings: filteredSettings,
        },
      };

      const jsonStr = JSON.stringify(exportObj, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dpp-config-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setShowExportDialog(false);
      toast('配置导出成功！', 'success');
    } catch (e) {
      logger.error('Export error:', e);
      toast('导出失败，请查看控制台', 'error');
    }
  };

  const handleSelectFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const parsed = JSON.parse(text);

        if (!parsed.version || !parsed.data) {
          throw new Error('无效的备份文件格式');
        }

        if (!parsed.data.settings?.length) {
          throw new Error('文件中没有应用设置数据');
        }

        const hasKey = parsed.data.settings.some(
          (s: { key: string }) => s.key === 'sync_encryption_key'
        );
        const confirmed = await confirm(
          `确定要导入配置数据吗？\n\n导出时间: ${new Date(parsed.exportDate).toLocaleString()}\n版本: ${parsed.version}\n${hasKey ? '包含同步密钥: 是\n' : '包含同步密钥: 否\n'}\n⚠️ 这将清空所有本地数据，导入后请重新同步！`,
          '确认导入'
        );

        if (!confirmed) return;

        // Clear all data first
        await db.delete();
        await db.open();

        await db.transaction('rw', db.settings, async () => {
          let settings = parsed.data.settings.filter(
            (s: { key: string }) => !EXCLUDED_SETTINGS.includes(s.key)
          );

          const hasEnvironments = settings.some(
            (s: { key: string }) => s.key === 'jenkins_environments'
          );
          const host = settings.find((s: { key: string }) => s.key === 'jenkins_host');
          const user = settings.find((s: { key: string }) => s.key === 'jenkins_user');
          const token = settings.find((s: { key: string }) => s.key === 'jenkins_token');

          if (!hasEnvironments && (host || user || token)) {
            const defaultEnv = {
              id: crypto.randomUUID(),
              name: 'Default',
              host: (host?.value as string) || '',
              user: (user?.value as string) || '',
              token: (token?.value as string) || '',
              order: 0,
            };
            settings.push({ key: 'jenkins_environments', value: [defaultEnv] });

            if (!settings.some((s: { key: string }) => s.key === 'jenkins_current_env')) {
              settings.push({ key: 'jenkins_current_env', value: defaultEnv.id });
            }

            logger.info('Migrated legacy Jenkins settings during import');
          }

          settings = settings.filter(
            (s: { key: string }) =>
              !['jenkins_host', 'jenkins_user', 'jenkins_token'].includes(s.key)
          );

          await db.settings.bulkAdd(settings as Parameters<typeof db.settings.bulkAdd>[0]);
        });

        toast('配置导入成功！即将刷新页面...', 'success');
        setTimeout(() => window.location.reload(), 1500);
      } catch (e) {
        logger.error('Import error:', e);
        toast(`导入失败: ${e instanceof Error ? e.message : String(e)}`, 'error');
      }
    };

    input.click();
  };

  const clearData = async () => {
    const confirmed = await confirm('确定要清空所有数据并重置吗？', '确认清空', 'danger');
    if (confirmed) {
      await db.delete();
      await db.open();
      toast('数据已清空', 'info');
      setTimeout(() => window.location.reload(), 1000);
    }
  };

  const toggleFeature = async (feature: 'hotNews' | 'links', enabled: boolean) => {
    const key = feature === 'hotNews' ? 'feature_hotnews_enabled' : 'feature_links_enabled';
    await db.settings.put({ key, value: enabled });
    setFeatureToggles((prev) => ({ ...prev, [feature]: enabled }));
    toast(
      `${feature === 'hotNews' ? '热点' : '链接'}功能已${enabled ? '启用' : '禁用'}`,
      'success'
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto p-8 max-w-2xl">
        <h1 className="text-2xl font-bold mb-6">DPP 设置</h1>

        <div className="space-y-8">
          <section className="space-y-4 border p-4 rounded-lg">
            <h2 className="text-xl font-semibold">外观</h2>
            <div className="space-y-2">
              <div className="text-sm font-medium">主题</div>
              <ThemeToggle />
            </div>
          </section>

          <section className="space-y-4 border p-4 rounded-lg">
            <h2 className="text-xl font-semibold">功能开关</h2>
            <p className="text-sm text-muted-foreground">控制在主界面中显示哪些功能标签页</p>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="feature-hotnews"
                  checked={featureToggles.hotNews}
                  onCheckedChange={(checked) => toggleFeature('hotNews', !!checked)}
                />
                <Label htmlFor="feature-hotnews" className="text-sm font-medium cursor-pointer">
                  热点
                </Label>
              </div>
            </div>
          </section>

          {/* Jenkins Section */}
          <section className="space-y-4 border p-4 rounded-lg">
            <h2 className="text-xl font-semibold flex items-center gap-2">Jenkins 环境管理</h2>
            <JenkinsEnvManager />
          </section>

          {/* Data Source Section */}
          <section className="space-y-4 border p-4 rounded-lg">
            <h2 className="text-xl font-semibold">数据同步配置</h2>

            {lastSyncTime && (
              <div className="text-xs text-muted-foreground mb-4">
                上次同步: {new Date(lastSyncTime).toLocaleString()}
              </div>
            )}

            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="i-lucide-server text-primary" />
                <span className="font-semibold text-sm">同步服务器</span>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                连接到您自己部署的 DPP 服务器，实现跨设备数据同步、标签云端备份、多端实时协作。
              </p>
              <div className="space-y-2">
                <Label htmlFor="custom-url">服务器地址</Label>
                <Input
                  id="custom-url"
                  value={customConfig.serverUrl}
                  onChange={(e) => setCustomConfig({ ...customConfig, serverUrl: e.target.value })}
                  placeholder="http://localhost:3000"
                  maxLength={VALIDATION_LIMITS.SYNC_SERVER_URL_MAX}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="access-token">访问令牌 (可选)</Label>
                <Input
                  id="access-token"
                  type="password"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="your-secret-token"
                  maxLength={VALIDATION_LIMITS.SYNC_ACCESS_TOKEN_MAX}
                />
              </div>

              <SyncKeyManager />

              <Button
                onClick={saveDataSourceConfig}
                className="bg-purple-600 hover:bg-purple-700 w-full"
              >
                保存
              </Button>
            </div>
          </section>

          {/* Data Management */}
          <section className="space-y-4 border p-4 rounded-lg">
            <h2 className="text-xl font-semibold">数据管理</h2>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                导出仅包含关键配置项，链接和任务数据请通过远程同步获取。
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => setShowExportDialog(true)}
                  variant="outline"
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  导出配置
                </Button>
                <Button onClick={handleSelectFile} variant="outline" className="gap-2">
                  <Upload className="w-4 h-4" />
                  导入配置
                </Button>
              </div>
            </div>
          </section>

          {/* Danger Zone */}
          <section className="space-y-4 border p-4 rounded-lg border-destructive/30">
            <h2 className="text-xl font-semibold text-destructive">危险区域</h2>
            <Button variant="destructive" onClick={clearData}>
              清空所有数据并重置
            </Button>
          </section>

          {/* Export Dialog */}
          <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>导出应用设置</DialogTitle>
                <DialogDescription>选择要导出的设置类型</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-4">
                {SETTINGS_CATEGORIES.map((category) => (
                  <div key={category.key} className="flex items-center space-x-3">
                    <Checkbox
                      id={`export-${category.key}`}
                      checked={selectedCategories.includes(category.key)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedCategories([...selectedCategories, category.key]);
                        } else {
                          setSelectedCategories(
                            selectedCategories.filter((k) => k !== category.key)
                          );
                        }
                      }}
                    />
                    <Label
                      htmlFor={`export-${category.key}`}
                      className="text-sm font-medium cursor-pointer"
                    >
                      {category.label}
                      <span className="text-muted-foreground text-xs ml-2">
                        {category.description}
                      </span>
                    </Label>
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowExportDialog(false)}>
                  取消
                </Button>
                <Button onClick={handleExport}>导出</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="flex justify-center pt-8 pb-4 opacity-50 hover:opacity-100 transition-opacity">
            <a
              href="https://github.com/slothvips/DPP"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <Github className="w-3 h-3" />
              Open Source on GitHub
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ToastProvider>
        <ConfirmDialogProvider>
          <OptionsApp />
        </ConfirmDialogProvider>
      </ToastProvider>
    </React.StrictMode>
  );
}
