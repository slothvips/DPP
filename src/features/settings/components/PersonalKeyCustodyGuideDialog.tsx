import { Copy, ShieldAlert } from 'lucide-react';
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
import {
  PERSONAL_KEY_CUSTODY_ITEMS,
  PERSONAL_KEY_CUSTODY_SUMMARY,
  PERSONAL_KEY_CUSTODY_TITLE,
} from './personalKeyCustodyGuide';

interface PersonalKeyCustodyGuideDialogProps {
  keyString: string;
  open: boolean;
  onCopyKey: () => void;
  onOpenChange: (open: boolean) => void;
}

export function PersonalKeyCustodyGuideDialog({
  keyString,
  open,
  onCopyKey,
  onOpenChange,
}: PersonalKeyCustodyGuideDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[calc(100vw-2rem)] sm:max-w-[480px]"
        data-testid="personal-key-custody-guide-dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 shrink-0 text-destructive" />
            {PERSONAL_KEY_CUSTODY_TITLE}
          </DialogTitle>
          <DialogDescription className="text-sm text-foreground">
            {PERSONAL_KEY_CUSTODY_SUMMARY}
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-3 rounded-md border border-destructive/20 bg-destructive/5 p-3">
          {PERSONAL_KEY_CUSTODY_ITEMS.map((item) => (
            <li key={item.title} className="space-y-0.5">
              <p className="text-xs font-semibold text-destructive">{item.title}</p>
              <p className="text-[11px] leading-5 text-muted-foreground">{item.detail}</p>
            </li>
          ))}
        </ul>

        {keyString ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">你的个人私钥（请立即备份）</p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={keyString}
                className="min-w-0 font-mono text-sm"
                data-testid="personal-key-custody-guide-key"
                autoComplete="off"
              />
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                onClick={onCopyKey}
                data-testid="personal-key-custody-guide-copy"
              >
                <Copy className="mr-1.5 h-4 w-4" />
                复制
              </Button>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            data-testid="personal-key-custody-guide-ack"
          >
            已备份，我知道了
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
