import { Button } from '@/components/ui/button';

interface DangerZoneSectionProps {
  onClearData: () => void | Promise<void>;
}

export function DangerZoneSection({ onClearData }: DangerZoneSectionProps) {
  return (
    <section
      className="min-w-0 space-y-4 rounded-lg border border-destructive/30 p-4"
      data-testid="danger-zone"
    >
      <h2 className="text-xl font-semibold text-destructive">危险区域</h2>
      <Button
        variant="destructive"
        className="w-full sm:w-auto"
        onClick={onClearData}
        data-testid="button-clear-data"
      >
        清空所有数据并重置
      </Button>
    </section>
  );
}
