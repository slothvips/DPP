import { Server } from 'lucide-react';

export function PersonalKeyNeedsServerState() {
  return (
    <div
      className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-3"
      data-testid="personal-key-needs-server"
    >
      <div className="flex items-start gap-2">
        <Server className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium text-foreground">请先配置同步服务器</p>
          <p className="text-[11px] leading-5 text-muted-foreground">
            个人私钥用于加密同步验证器等个人数据，需先填写并保存上方的服务器地址后再生成或导入。
          </p>
        </div>
      </div>
    </div>
  );
}
