import { useCallback, useEffect, useRef, useState } from 'react';
import type { RecordingStatusResponse } from '../messages';

export function useRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [startTime, setStartTime] = useState<number | undefined>();
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (tabs.length === 0 || !tabs[0].id) return;

      const tabId = tabs[0].id;
      const status = (await browser.runtime.sendMessage({
        type: 'RECORDER_GET_STATUS',
        tabId,
      })) as RecordingStatusResponse;

      if (status?.isRecording && status.startTime) {
        setIsRecording(true);
        setStartTime(status.startTime);
      }
    };
    checkStatus();
  }, []);

  useEffect(() => {
    if (isRecording && startTime) {
      const updateTimer = () => {
        setDuration(Date.now() - startTime);
      };
      timerRef.current = window.setInterval(updateTimer, 1000);
      updateTimer();
    } else {
      if (timerRef.current) window.clearInterval(timerRef.current);
      setDuration(0);
    }
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [isRecording, startTime]);

  useEffect(() => {
    const handleMessage = (message: unknown) => {
      if (
        typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        (message as { type: string }).type === 'RECORDER_SAVED'
      ) {
        setIsRecording(false);
        setStartTime(undefined);
      }
    };
    browser.runtime.onMessage.addListener(handleMessage);
    return () => browser.runtime.onMessage.removeListener(handleMessage);
  }, []);

  const startRecording = useCallback(async () => {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0 || !tabs[0].id) return;

    try {
      await browser.runtime.sendMessage({
        type: 'RECORDER_START',
        tabId: tabs[0].id,
      });
      setIsRecording(true);
      setStartTime(Date.now());
    } catch {
      // Popup may close before response - ignore
    }
  }, []);

  return { isRecording, duration, startRecording };
}
