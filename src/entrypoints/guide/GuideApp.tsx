import { ExternalLink, Rocket, Settings } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/utils/cn';

interface StepCardProps {
  step: number;
  icon: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  className?: string;
}

function StepCard({ step, icon, title, children, className }: StepCardProps) {
  return (
    <div className={cn('rounded-lg border bg-card shadow-sm', className)}>
      <div className="border-b bg-muted/30 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground font-bold">
            {step}
          </div>
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
        </div>
      </div>
      {children && <div className="px-6 py-5">{children}</div>}
    </div>
  );
}

export function GuideApp() {
  useTheme();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-primary/60 text-primary-foreground">
              <Rocket className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">DPP</h1>
              <p className="text-sm text-muted-foreground">开始使用</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6">
          <StepCard step={1} icon={<Settings className="w-5 h-5" />} title="配置 Jenkins">
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>访问 Jenkins → 用户设置 → API Token</li>
              <li>生成 Token 并复制</li>
              <li>在扩展选项页填写 Jenkins 地址、用户名、Token</li>
              <li>测试连接</li>
            </ol>
          </StepCard>

          <StepCard step={2} icon={<Rocket className="w-5 h-5" />} title="开始使用">
            <div className="text-sm text-muted-foreground space-y-2">
              <p>点击工具栏图标打开扩展面板</p>
              <p>
                地址栏快捷访问: <code className="px-2 py-1 bg-muted rounded">dpp</code> + 空格
              </p>
            </div>
          </StepCard>
        </div>

        <section className="rounded-lg border bg-card p-8 text-center mt-8">
          <div className="max-w-2xl mx-auto">
            <Rocket className="w-12 h-12 text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-3">准备好了</h2>
            <p className="text-muted-foreground mb-6">点击浏览器工具栏图标开始使用</p>
            <div className="flex gap-3 justify-center">
              <button
                type="button"
                className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                onClick={() => window.close()}
              >
                开始使用
              </button>
              <button
                type="button"
                className="px-6 py-3 border rounded-lg font-medium hover:bg-muted/50 transition-colors flex items-center gap-2"
                onClick={() => {
                  window.open('https://github.com', '_blank');
                }}
              >
                <ExternalLink className="w-4 h-4" />
                文档
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
