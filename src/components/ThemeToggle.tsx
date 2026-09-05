import { Moon, Sun } from 'lucide-react';
import type { MouseEvent } from 'react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/useTheme';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const ThemeIcon = theme === 'dark' ? Moon : Sun;
  const nextTheme = theme === 'dark' ? 'light' : 'dark';
  const currentLabel = theme === 'dark' ? '深色' : '浅色';
  const nextLabel = nextTheme === 'dark' ? '深色' : '浅色';

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    void setTheme(nextTheme, {
      x: event.clientX,
      y: event.clientY,
    });
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 shrink-0 rounded-lg border border-border/55 bg-muted/35 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
      aria-label={`切换主题，当前为${currentLabel}，点击切换到${nextLabel}`}
      title={`当前：${currentLabel}，点击切换到${nextLabel}`}
      data-testid="theme-toggle"
      onClick={handleClick}
    >
      <ThemeIcon className="h-4 w-4" />
    </Button>
  );
}
