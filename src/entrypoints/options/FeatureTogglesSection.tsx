import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { FeatureTogglesState } from './optionsTypes';

const FEATURE_OPTIONS = [
  { key: 'blackboard', label: '黑板' },
  { key: 'jenkins', label: 'Jenkins' },
  { key: 'links', label: '链接' },
  { key: 'recorder', label: '录制' },
  { key: 'hotNews', label: '资讯' },
  { key: 'aiAssistant', label: 'D仔' },
  { key: 'playground', label: '游乐园' },
] as const satisfies Array<{
  key: keyof FeatureTogglesState;
  label: string;
}>;

interface FeatureTogglesSectionProps {
  featureToggles: FeatureTogglesState;
  onToggle: (feature: keyof FeatureTogglesState, enabled: boolean) => void | Promise<void>;
}

export function FeatureTogglesSection({ featureToggles, onToggle }: FeatureTogglesSectionProps) {
  return (
    <section className="min-w-0 space-y-4 rounded-lg border p-4">
      <h2 className="text-xl font-semibold">功能开关</h2>
      <p className="text-sm text-muted-foreground">控制在主界面中显示哪些功能标签页</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" data-testid="feature-toggles">
        {FEATURE_OPTIONS.map(({ key, label }) => (
          <div key={key} className="flex items-center space-x-3">
            <Checkbox
              id={`feature-${key}`}
              data-testid={`checkbox-feature-${key}`}
              checked={featureToggles[key]}
              onCheckedChange={(checked) => onToggle(key, !!checked)}
            />
            <Label htmlFor={`feature-${key}`} className="text-sm font-medium cursor-pointer">
              {label}
            </Label>
          </div>
        ))}
      </div>
    </section>
  );
}
