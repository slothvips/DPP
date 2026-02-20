import { useCallback, useEffect, useRef, useState } from 'react';
import type { RecordingStartResponse, RecordingStatusResponse } from '../messages';

export function useRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [startTime, setStartTime] = useState<number | undefined>();
  const [isPageSupported, setIsPageSupported] = useState<boolean | null>(null);
  const timerRef = useRef<number | null>(null);

  // 检测当前页面是否支持录制
  const checkPageSupport = useCallback(async () => {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0 || !tabs[0].id) {
      setIsPageSupported(false);
      return;
    }

    const tabId = tabs[0].id;
    try {
      // 尝试发送一个简单消息来检测 content script 是否存在
      await browser.tabs.sendMessage(tabId, { type: 'RECORDER_PING' });
      setIsPageSupported(true);
    } catch {
      setIsPageSupported(false);
    }
  }, []);

  useEffect(() => {
    checkPageSupport();
  }, [checkPageSupport]);

  // 监听 tab 切换和页面更新，动态检测页面是否支持录制
  useEffect(() => {
    const handleTabActivated = async (activeInfo: { tabId: number }) => {
      // 延迟一下等待 content script 加载
      setTimeout(() => checkPageSupport(), 100);
    };

    const handleTabUpdated = async (tabId: number) => {
      // 页面更新（URL 变化），重新检测
      setTimeout(() => checkPageSupport(), 100);
    };

    browser.tabs.onActivated.addListener(handleTabActivated);
    browser.tabs.onUpdated.addListener(handleTabUpdated);

    return () => {
      browser.tabs.onActivated.removeListener(handleTabActivated);
      browser.tabs.onUpdated.removeListener(handleTabUpdated);
    };
  }, [checkPageSupport]);

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

  const startRecording = useCallback(async (): Promise<RecordingStartResponse> => {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0 || !tabs[0].id) {
      return { success: false, error: 'No active tab found' };
    }

    try {
      const response = (await browser.runtime.sendMessage({
        type: 'RECORDER_START',
        tabId: tabs[0].id,
      })) as RecordingStartResponse;

      if (response.success) {
        setIsRecording(true);
        setStartTime(Date.now());
      }

      return response;
    } catch {
      return { success: false, error: 'Failed to communicate with background' };
    }
  }, []);

  return {
    isRecording,
    duration,
    startRecording,
    isPageSupported,
    refetchPageSupport: checkPageSupport,
  };
}
