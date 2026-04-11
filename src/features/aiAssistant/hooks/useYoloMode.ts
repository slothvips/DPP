import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { YOLO_MODE_KEY } from '@/lib/ai/tools';

export function useYoloMode() {
  const [yoloMode, setYoloMode] = useState(false);

  useEffect(() => {
    browser.storage.session
      .get(YOLO_MODE_KEY)
      .then((result) => {
        if (result[YOLO_MODE_KEY] === true) {
          setYoloMode(true);
        }
      })
      .catch(() => {});

    const listener = (changes: Record<string, { newValue?: unknown }>) => {
      if (changes[YOLO_MODE_KEY]) {
        setYoloMode(changes[YOLO_MODE_KEY].newValue === true);
      }
    };

    browser.storage.session.onChanged.addListener(listener);
    return () => {
      browser.storage.session.onChanged.removeListener(listener);
    };
  }, []);

  return { yoloMode, setYoloMode };
}
