import {
  Check,
  Database,
  Github,
  Key,
  Laptop,
  Settings,
  Shield,
  Users,
  Wand2,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/useTheme';

export function GuideApp() {
  useTheme();

  const openOptions = () => {
    if (typeof browser !== 'undefined' && browser.runtime?.getURL) {
      window.open(browser.runtime.getURL('/options.html'), '_blank');
    } else {
      window.location.href = '/options.html';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-foreground flex items-center justify-center p-4">
      <div className="max-w-4xl w-full bg-background border shadow-xl rounded-xl overflow-hidden flex flex-col md:flex-row">
        {/* Left: Introduction & Core Value */}
        <div className="md:w-5/12 bg-muted/20 p-8 flex flex-col border-r">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-primary text-primary-foreground rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
              <Zap className="w-6 h-6 fill-current" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">DPP</h1>
              <p className="text-xs text-muted-foreground font-medium">Dev Productivity Platform</p>
            </div>
          </div>

          <div className="space-y-6 flex-1">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold tracking-tight">
                零散数据，汇聚一处
                <br />
                人人贡献，全员共享
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                数据不应散落在聊天记录和口口相传里。
                DPP连接数据孤岛，让每一个人的贡献都能即刻造福整个团队。
              </p>
            </div>

            <div className="space-y-4 pt-4">
              <FeatureRow
                icon={<Database className="w-4 h-4 text-blue-500" />}
                title="数据聚合"
                desc="不用到处翻链接、查状态。构建任务、常用网址、环境入口，全都放在手边。"
              />
              <FeatureRow
                icon={<Users className="w-4 h-4 text-orange-500" />}
                title="团队共建"
                desc="发现好用的工具或文档？加个标签大家都能用。一人整理，全组受益。"
              />
              <FeatureRow
                icon={<Shield className="w-4 h-4 text-green-500" />}
                title="安全共享"
                desc="配置同步加密传输，不用担心敏感信息泄露。只有持有密钥的自己人能解开。"
              />
            </div>
          </div>

          <div className="mt-8 pt-6 border-t flex gap-3 text-xs text-muted-foreground">
            <a
              href="https://github.com/slothvips/DPP"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <Github className="w-3.5 h-3.5" />
              源码
            </a>
          </div>
        </div>

        {/* Right: Setup Guide */}
        <div className="md:w-7/12 p-8 flex flex-col">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold">三步开启协作</h2>
            <Button variant="ghost" size="sm" onClick={openOptions} className="text-xs h-8">
              <Settings className="w-3.5 h-3.5 mr-1.5" />
              打开完整设置
            </Button>
          </div>

          <div className="space-y-8 flex-1">
            {/* Step 1: Jenkins */}
            <div className="relative pl-8 group">
              <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center border border-primary/20 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                1
              </div>
              <div className="absolute left-3 top-8 bottom-0 w-px bg-border group-hover:bg-primary/20 transition-colors" />

              <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                连接 (Jenkins)
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-normal">
                  基础
                </span>
              </h3>
              <p className="text-xs text-muted-foreground mb-3">
                输入 Jenkins 地址，让 DPP 自动获取您的构建数据。推荐使用
                <strong className="text-foreground">自动检测</strong>。
              </p>
              <div className="bg-muted/40 rounded border p-3 text-xs space-y-2">
                <div className="flex items-center gap-2">
                  <Laptop className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="font-mono text-muted-foreground">
                    http://jenkins.company.com
                  </span>
                </div>
                <div className="flex items-center gap-2 text-primary">
                  <Wand2 className="w-3.5 h-3.5" />
                  <span className="font-medium">点击设置页的"自动检测"按钮即可</span>
                </div>
              </div>
            </div>

            {/* Step 2: Sync */}
            <div className="relative pl-8 group">
              <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs font-bold flex items-center justify-center border group-hover:border-primary/50 group-hover:text-primary transition-colors">
                2
              </div>
              <div className="absolute left-3 top-8 bottom-0 w-px bg-border group-hover:bg-primary/20 transition-colors" />

              <h3 className="font-semibold text-sm mb-2">加入团队网络</h3>
              <p className="text-xs text-muted-foreground mb-3">
                配置<strong className="text-foreground">同步自建服务地址以及密钥</strong>
                ，即可接入团队的共享网络，获取大家贡献的标签和链接。
              </p>
              <div className="flex gap-2 text-xs">
                <div className="flex-1 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900/30 p-2 rounded text-yellow-800 dark:text-yellow-200">
                  <Key className="w-3 h-3 inline mr-1" />
                  请向管理员索要团队通用的<strong className="underline">同步密钥</strong>。
                </div>
              </div>
            </div>

            {/* Step 3: Usage */}
            <div className="relative pl-8 group">
              <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs font-bold flex items-center justify-center border group-hover:border-primary/50 group-hover:text-primary transition-colors">
                3
              </div>

              <h3 className="font-semibold text-sm mb-2">开始贡献与享受</h3>
              <p className="text-xs text-muted-foreground mb-3">
                配置完成！您现在可以享受便捷的导航，以及和团队进行数据共享。
              </p>

              <div className="border-t my-3 border-dashed" />

              <div className="flex items-center gap-2 text-sm">
                <span className="text-xs text-muted-foreground ml-1">地址栏</span>
                <kbd className="px-2 py-1 bg-background border rounded-md shadow-sm font-mono text-xs">
                  dpp
                </kbd>
                <span className="text-muted-foreground text-xs">+</span>
                <kbd className="px-2 py-1 bg-background border rounded-md shadow-sm font-mono text-xs">
                  Space
                </kbd>
                <span className="text-xs text-muted-foreground ml-1">
                  键入关键词即可搜索相关资源
                </span>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t">
            <Button className="w-full shadow-lg shadow-primary/20" onClick={() => window.close()}>
              <Check className="w-4 h-4 mr-2" />
              我准备好了
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureRow({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 shrink-0 w-6 h-6 rounded bg-background border flex items-center justify-center shadow-sm">
        {icon}
      </div>
      <div>
        <h4 className="text-sm font-medium leading-none mb-1.5">{title}</h4>
        <p className="text-xs text-muted-foreground leading-snug">{desc}</p>
      </div>
    </div>
  );
}
