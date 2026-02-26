import { Lightbulb, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/utils/cn';

const TIPS = [
  { icon: Lightbulb, text: '链接单击打开，双击复制地址', color: 'text-green-500' },
  { icon: Sparkles, text: '搜索支持空格分隔多关键词', color: 'text-indigo-500' },
  { icon: Sparkles, text: '地址栏输入 dpp + 空格，全局快速搜索', color: 'text-indigo-500' },
  { icon: Lightbulb, text: 'Jenkins 支持多环境切换，在设置中配置', color: 'text-green-500' },
  { icon: Lightbulb, text: 'AI 助手支持自然语言管理链接、Job、便签', color: 'text-green-500' },
  { icon: Lightbulb, text: '便签支持 Markdown 格式', color: 'text-green-500' },
];

export function Tips() {
  const [tip, setTip] = useState(TIPS[0]);
  const [fade, setFade] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    // Only randomize on initial mount
    const randomStart = Math.floor(Math.random() * TIPS.length);
    setTip(TIPS[randomStart]);
  }, []);

  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setTip((prev) => {
          const nextIndex = (TIPS.indexOf(prev) + 1) % TIPS.length;
          return TIPS[nextIndex];
        });
        setFade(true);
      }, 300);
    }, 5000);

    return () => clearInterval(interval);
  }, [isPaused]);

  const Icon = tip.icon;

  return (
    <div
      className="flex items-center justify-center flex-1 mx-4 overflow-hidden cursor-help"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div
        className={cn(
          'flex items-center gap-3 text-sm transition-all duration-300 px-6 py-2.5 rounded-full bg-gradient-to-r from-muted/50 to-muted/30 border border-border/60 shadow-sm hover:shadow-md max-w-full backdrop-blur-sm',
          fade ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'
        )}
      >
        <Icon className={cn('w-4 h-4 shrink-0', tip.color)} />
        <span className="truncate text-foreground/80 font-medium tracking-wide">{tip.text}</span>
      </div>
    </div>
  );
}
