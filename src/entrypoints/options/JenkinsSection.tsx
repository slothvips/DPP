import { JenkinsEnvManager } from '@/features/settings/components/JenkinsEnvManager';

export function JenkinsSection() {
  return (
    <section className="min-w-0 space-y-4 rounded-lg border p-4">
      <h2 className="text-xl font-semibold flex items-center gap-2">Jenkins 环境管理</h2>
      <JenkinsEnvManager />
    </section>
  );
}
