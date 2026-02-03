import { useEffect, useState } from 'react';

export function RefreshCountdown({ targetTime }: { targetTime: number }) {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    const update = () => {
      const diff = Math.max(0, Math.ceil((targetTime - Date.now()) / 1000));
      setTimeLeft(diff);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [targetTime]);

  if (timeLeft <= 0) return null;
  return <span className="text-[10px] text-muted-foreground">{timeLeft}s</span>;
}
