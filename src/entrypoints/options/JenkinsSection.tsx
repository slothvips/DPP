import { JenkinsEnvManager } from '@/features/settings/components/JenkinsEnvManager';

export function JenkinsSection() {
  return (
    <section className="space-y-4 border p-4 rounded-lg">
      <h2 className="text-xl font-semibold flex items-center gap-2">Jenkins 环境管理</h2>
      <JenkinsEnvManager />
    </section>
  );
}
