/**
 * YOLO 模式按钮组件
 * 显示在 header 上，用于控制 AI 工具的自动确认模式
 */
import { Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { Button } from '@/components/ui/button';
import { YOLO_MODE_KEY } from '@/lib/ai/tools';
import { cn } from '@/utils/cn';
import { useConfirmDialog } from '@/utils/confirm-dialog';

export function YoloButton() {
  const [yoloMode, setYoloMode] = useState(false);
  const { confirm } = useConfirmDialog();

  // 从 storage 初始化 YOLO 模式并监听变化
  useEffect(() => {
    // 初始化
    browser.storage.session
      .get(YOLO_MODE_KEY)
      .then((result) => {
        if (result[YOLO_MODE_KEY] === true) {
          setYoloMode(true);
        }
      })
      .catch(() => {});

    // 监听变化
    const handleChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes[YOLO_MODE_KEY]) {
        setYoloMode(changes[YOLO_MODE_KEY].newValue === true);
      }
    };

    browser.storage.onChanged.addListener(handleChange);
    return () => {
      browser.storage.onChanged.removeListener(handleChange);
    };
  }, []);

  const toggleYoloMode = async () => {
    if (!yoloMode) {
      const ok = await confirm(
        'YOLO 模式会跳过所有确认对话框，自动执行工具操作，可能导致意外修改。\n\n建议仅在网页操作时开启，避免对数据造成不可逆的更改。\n\n确定要开启吗？',
        '开启 YOLO 模式',
        'danger'
      );
      if (!ok) return;
    }
    const newValue = !yoloMode;
    setYoloMode(newValue);
    await browser.storage.session.set({ [YOLO_MODE_KEY]: newValue });
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleYoloMode}
      title="YOLO 模式：自动确认所有工具调用"
      className={cn(
        'text-xs gap-1 transition-all duration-300 border border-border h-8 px-2',
        yoloMode && 'yolo-button-active'
      )}
      data-testid="yolo-button"
    >
      <Zap className={cn('w-3.5 h-3.5', yoloMode && 'fill-primary text-primary')} />
      <span className={yoloMode ? 'text-primary font-medium' : ''}>YOLO</span>
    </Button>
  );
}
