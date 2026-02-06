import { BookOpen, Download, Upload } from 'lucide-react';
import 'virtual:uno.css';
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToastProvider, useToast } from '@/components/ui/toast';
import { db } from '@/db';
import { JenkinsEnvManager } from '@/features/settings/components/JenkinsEnvManager';
import { SyncKeyManager } from '@/features/settings/components/SyncKeyManager';
import { useTheme } from '@/hooks/useTheme';
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

function OptionsApp() {
  useTheme();
  const { toast } = useToast();
  const [customConfig, setCustomConfig] = useState({ serverUrl: '' });
  const [accessToken, setAccessToken] = useState('');
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [featureToggles, setFeatureToggles] = useState({
    hotNews: true,
    links: true,
  });

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

  const exportData = async () => {
    try {
      const allSettings = await db.settings.toArray();
      const safeSettings = allSettings.filter((s) => !EXCLUDED_SETTINGS.includes(s.key));

      const hasEncryptionKey = safeSettings.some((s) => s.key === 'sync_encryption_key');

      if (hasEncryptionKey) {
        const confirmed = confirm(
          '安全提示：\n\n导出文件中将包含您的【同步加密密钥】。\n\n请务必妥善保管导出文件，不要分享给不可信的人，否则可能导致您的加密数据泄露。\n\n是否继续？'
        );
        if (!confirmed) return;
      }

      const exportObj = {
        version: '1.3',
        exportDate: new Date().toISOString(),
        data: {
          settings: safeSettings,
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

      toast('配置导出成功！', 'success');
    } catch (e) {
      logger.error('Export error:', e);
      toast('导出失败，请查看控制台', 'error');
    }
  };

  const importData = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const importObj = JSON.parse(text);

        if (!importObj.version || !importObj.data) {
          throw new Error('无效的备份文件格式');
        }

        const hasKey = importObj.data.settings?.some(
          (s: { key: string }) => s.key === 'sync_encryption_key'
        );
        const confirmed = confirm(
          `确定要导入配置数据吗？\n\n导出时间: ${new Date(importObj.exportDate).toLocaleString()}\n版本: ${importObj.version}\n${hasKey ? '包含同步密钥: 是\n' : '包含同步密钥: 否\n'}\n这将覆盖当前配置！(链接等数据需重新同步)`
        );

        if (!confirmed) return;

        await db.transaction('rw', ['settings'], async () => {
          await db.settings.clear();
          if (importObj.data.settings?.length) {
            const safeSettings = importObj.data.settings.filter(
              (s: { key: string }) => !EXCLUDED_SETTINGS.includes(s.key)
            );
            await db.settings.bulkAdd(safeSettings);
          }
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
    if (confirm('确定要清空所有数据并重置吗？')) {
      await db.delete();
      await db.open();
      toast('数据已清空', 'info');
      setTimeout(() => window.location.reload(), 1000);
    }
  };

  const openGuide = () => {
    browser.tabs.create({ url: browser.runtime.getURL('/guide.html') });
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
                  id="feature-links"
                  checked={featureToggles.links}
                  onCheckedChange={(checked) => toggleFeature('links', !!checked)}
                />
                <Label htmlFor="feature-links" className="text-sm font-medium cursor-pointer">
                  链接
                </Label>
              </div>
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

          <section className="space-y-4 border p-4 rounded-lg">
            <h2 className="text-xl font-semibold">帮助</h2>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">查看详细的功能介绍和使用说明</p>
              <Button onClick={openGuide} variant="outline" className="gap-2">
                <BookOpen className="w-4 h-4" />
                打开使用指南
              </Button>
            </div>
          </section>

          {/* Jenkins Section */}
          <section className="space-y-4 border p-4 rounded-lg">
            <h2 className="text-xl font-semibold flex items-center gap-2">Jenkins Environments</h2>
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

              <div className="pt-2">
                <Button
                  onClick={saveDataSourceConfig}
                  className="bg-purple-600 hover:bg-purple-700 w-full sm:w-auto"
                >
                  保存
                </Button>
              </div>
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
                <Button onClick={exportData} variant="outline" className="gap-2">
                  <Download className="w-4 h-4" />
                  导出配置
                </Button>
                <Button onClick={importData} variant="outline" className="gap-2">
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
        <OptionsApp />
      </ToastProvider>
    </React.StrictMode>
  );
}
