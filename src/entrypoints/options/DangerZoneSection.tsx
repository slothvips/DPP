import { Button } from '@/components/ui/button';

interface DangerZoneSectionProps {
  onClearData: () => void | Promise<void>;
}

export function DangerZoneSection({ onClearData }: DangerZoneSectionProps) {
  return (
    <section
      className="space-y-4 border p-4 rounded-lg border-destructive/30"
      data-testid="danger-zone"
    >
      <h2 className="text-xl font-semibold text-destructive">危险区域</h2>
      <Button variant="destructive" onClick={onClearData} data-testid="button-clear-data">
        清空所有数据并重置
      </Button>
    </section>
  );
}
