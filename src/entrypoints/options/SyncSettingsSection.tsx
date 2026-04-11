import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SyncKeyManager } from '@/features/settings/components/SyncKeyManager';
import { VALIDATION_LIMITS } from '@/utils/validation';
import type { AutoSyncState, CustomConfigState } from './optionsTypes';

interface SyncSettingsSectionProps {
  accessToken: string;
  autoSync: AutoSyncState;
  customConfig: CustomConfigState;
  lastSyncTime: number | null;
  onAccessTokenChange: (value: string) => void;
  onAutoSyncChange: (value: AutoSyncState) => void;
  onCustomConfigChange: (value: CustomConfigState) => void;
  onSave: () => void | Promise<void>;
}

export function SyncSettingsSection({
  accessToken,
  autoSync,
  customConfig,
  lastSyncTime,
  onAccessTokenChange,
  onAutoSyncChange,
  onCustomConfigChange,
  onSave,
}: SyncSettingsSectionProps) {
  return (
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
            data-testid="input-server-url"
            value={customConfig.serverUrl}
            onChange={(e) => onCustomConfigChange({ ...customConfig, serverUrl: e.target.value })}
            placeholder="http://localhost:3000"
            maxLength={VALIDATION_LIMITS.SYNC_SERVER_URL_MAX}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="access-token">访问令牌 (可选)</Label>
          <Input
            id="access-token"
            data-testid="input-access-token"
            type="password"
            value={accessToken}
            onChange={(e) => onAccessTokenChange(e.target.value)}
            placeholder="your-secret-token"
            maxLength={VALIDATION_LIMITS.SYNC_ACCESS_TOKEN_MAX}
          />
        </div>

        <SyncKeyManager />

        <div className="space-y-4 pt-4 border-t border-border">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="auto-sync"
              checked={autoSync.enabled}
              onCheckedChange={(checked) =>
                onAutoSyncChange({ ...autoSync, enabled: checked as boolean })
              }
            />
            <Label htmlFor="auto-sync">开启自动同步</Label>
          </div>
          {autoSync.enabled && (
            <div className="space-y-2 pl-6">
              <Label htmlFor="auto-sync-interval">同步间隔</Label>
              <Select
                value={autoSync.interval.toString()}
                onValueChange={(value) =>
                  onAutoSyncChange({ ...autoSync, interval: Number(value) })
                }
              >
                <SelectTrigger id="auto-sync-interval" className="w-[180px]">
                  <SelectValue placeholder="选择间隔时间" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">每 5 分钟</SelectItem>
                  <SelectItem value="15">每 15 分钟</SelectItem>
                  <SelectItem value="30">每 30 分钟</SelectItem>
                  <SelectItem value="60">每 1 小时</SelectItem>
                  <SelectItem value="120">每 2 小时</SelectItem>
                  <SelectItem value="240">每 4 小时</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <Button
          onClick={onSave}
          data-testid="button-save-sync"
          className="bg-primary hover:bg-primary/90 w-full"
        >
          保存
        </Button>
      </div>
    </section>
  );
}
