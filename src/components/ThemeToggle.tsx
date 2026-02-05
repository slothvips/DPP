import { Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/utils/cn';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center gap-2 p-1 border rounded-lg bg-card text-card-foreground">
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          'gap-2 flex-1',
          theme === 'light' && 'bg-accent text-accent-foreground shadow-sm'
        )}
        onClick={() => setTheme('light')}
      >
        <Sun className="w-4 h-4" />
        <span className="sr-only sm:not-sr-only">浅色</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          'gap-2 flex-1',
          theme === 'dark' && 'bg-accent text-accent-foreground shadow-sm'
        )}
        onClick={() => setTheme('dark')}
      >
        <Moon className="w-4 h-4" />
        <span className="sr-only sm:not-sr-only">深色</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          'gap-2 flex-1',
          theme === 'system' && 'bg-accent text-accent-foreground shadow-sm'
        )}
        onClick={() => setTheme('system')}
      >
        <Monitor className="w-4 h-4" />
        <span className="sr-only sm:not-sr-only">系统</span>
      </Button>
    </div>
  );
}
