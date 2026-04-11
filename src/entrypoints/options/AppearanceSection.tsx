import { ThemeToggle } from '@/components/ThemeToggle';

export function AppearanceSection() {
  return (
    <section className="space-y-4 border p-4 rounded-lg" data-testid="section-appearance">
      <h2 className="text-xl font-semibold">外观</h2>
      <div className="space-y-2">
        <div className="text-sm font-medium">主题</div>
        <ThemeToggle />
      </div>
    </section>
  );
}
