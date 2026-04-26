import { Lightbulb, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/utils/cn';

const TIPS = [
  { icon: Sparkles, text: '任何搜索支持空格分隔多关键词', color: 'text-primary' },
  { icon: Lightbulb, text: 'Jenkins 支持多环境切换', color: 'text-success' },
  { icon: Lightbulb, text: 'D仔支持管理链接、Job、便签与页面', color: 'text-success' },
  { icon: Lightbulb, text: '便签支持 Markdown 格式', color: 'text-success' },
  { icon: Sparkles, text: '设置中可管理多个 Jenkins 凭证', color: 'text-primary' },
  { icon: Sparkles, text: '浏览器地址栏输入 [dpp + 空格]，全局快速搜索', color: 'text-primary' },
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
          'flex max-w-full items-center gap-2.5 rounded-full border border-border/55 bg-background/90 px-5 py-2 text-sm ring-1 ring-border/20 backdrop-blur transition-all duration-300 hover:border-border/70',
          fade ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'
        )}
      >
        <Icon className={cn('h-4 w-4 shrink-0', tip.color)} />
        <span className="truncate font-medium text-foreground">{tip.text}</span>
      </div>
    </div>
  );
}
