import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { db } from '@/db';

interface TotpPersonalKeyGateStatus {
  hasPersonalKey: boolean;
  hasSyncServer: boolean;
}

async function loadTotpPersonalKeyGateStatus(): Promise<TotpPersonalKeyGateStatus> {
  const [keySetting, serverSetting] = await Promise.all([
    db.settings.get('personal_encryption_key'),
    db.settings.get('custom_server_url'),
  ]);

  return {
    hasPersonalKey: typeof keySetting?.value === 'string' && keySetting.value.length > 0,
    hasSyncServer:
      typeof serverSetting?.value === 'string' && serverSetting.value.trim().length > 0,
  };
}

export function TotpPersonalKeyNotice() {
  const status = useLiveQuery(() => loadTotpPersonalKeyGateStatus(), []);

  if (!status || status.hasPersonalKey) {
    return null;
  }

  return (
    <div
      className="shrink-0 border-b border-destructive/25 bg-destructive/5 px-2.5 py-2"
      data-testid="totp-personal-key-notice"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-xs font-medium text-foreground">
            {status.hasSyncServer
              ? '请创建并妥善保管个人私钥'
              : '请先配置同步服务器，再创建个人私钥'}
          </p>
          <p className="text-[11px] leading-5 text-muted-foreground">
            {status.hasSyncServer ? (
              <>
                未配置时，验证器仅保存在本机，换设备或清空数据后无法自动恢复。配置后会用该私钥加密同步到你的其他设备；请勿将个人私钥分享给
                <span className="text-destructive">任何人</span>。
              </>
            ) : (
              '个人私钥依赖同步服务器完成加密同步。请先在设置中填写并保存服务器地址，再生成或导入个人私钥。'
            )}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 rounded-lg px-2 text-[11px]"
            onClick={() => {
              void browser.tabs.create({ url: browser.runtime.getURL('/options.html') });
            }}
            data-testid="totp-personal-key-notice-settings"
          >
            <Settings2 className="h-3 w-3" />
            去设置配置
          </Button>
        </div>
      </div>
    </div>
  );
}
