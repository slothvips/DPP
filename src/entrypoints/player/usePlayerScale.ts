import { useCallback, useEffect, useRef } from 'react';
import type { Replayer } from '@/vendor/rrweb/rrweb.js';

interface UsePlayerScaleOptions {
  hasPlayer: boolean;
  showSidePanel: boolean;
  playerAreaRef: React.RefObject<HTMLDivElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  mainRef: React.RefObject<HTMLElement | null>;
  replayerRef: React.RefObject<Replayer | null>;
}

export function usePlayerScale({
  hasPlayer,
  showSidePanel,
  playerAreaRef,
  containerRef,
  mainRef,
  replayerRef,
}: UsePlayerScaleOptions) {
  const lastAreaWidthRef = useRef(0);

  const updateScale = useCallback(() => {
    const doUpdate = () => {
      const playerArea = playerAreaRef.current;
      const replayer = replayerRef.current;
      if (!playerArea || !replayer) {
        return false;
      }

      const iframe = replayer.iframe;
      if (!iframe) {
        return false;
      }

      const recordingWidth = parseInt(iframe.width, 10) || iframe.offsetWidth;
      const recordingHeight = parseInt(iframe.height, 10) || iframe.offsetHeight;
      if (!recordingWidth || !recordingHeight) {
        return false;
      }

      const areaWidth = playerArea.clientWidth;
      const areaHeight = playerArea.clientHeight;
      if (!areaWidth || !areaHeight) {
        return false;
      }

      const scale = Math.min(areaWidth / recordingWidth, areaHeight / recordingHeight, 1);
      const scaledWidth = recordingWidth * scale;
      const scaledHeight = recordingHeight * scale;
      const offsetX = (areaWidth - scaledWidth) / 2;
      const offsetY = (areaHeight - scaledHeight) / 2;

      const wrapper = containerRef.current;
      if (wrapper) {
        wrapper.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
        wrapper.style.transformOrigin = 'top left';
        wrapper.style.width = `${recordingWidth}px`;
        wrapper.style.height = `${recordingHeight}px`;
      }

      return true;
    };

    requestAnimationFrame(() => {
      if (!doUpdate()) {
        setTimeout(() => requestAnimationFrame(doUpdate), 100);
      }
    });
  }, [containerRef, playerAreaRef, replayerRef]);

  useEffect(() => {
    if (!hasPlayer || !replayerRef.current) {
      return;
    }

    const timers = [50, 100, 200, 300, 500, 800, 1000, 1500].map((delay) =>
      setTimeout(updateScale, delay)
    );

    const resizeObserver = new ResizeObserver(() => {
      const currentWidth = playerAreaRef.current?.clientWidth || 0;
      if (currentWidth !== lastAreaWidthRef.current) {
        lastAreaWidthRef.current = currentWidth;
        updateScale();
      }
    });

    if (playerAreaRef.current) {
      resizeObserver.observe(playerAreaRef.current);
    }
    if (mainRef.current) {
      resizeObserver.observe(mainRef.current);
    }

    return () => {
      timers.forEach(clearTimeout);
      resizeObserver.disconnect();
    };
  }, [hasPlayer, mainRef, playerAreaRef, replayerRef, updateScale]);

  useEffect(() => {
    if (!hasPlayer) {
      return;
    }

    const timers = [0, 50, 100, 200, 300].map((delay) => setTimeout(updateScale, delay));
    return () => timers.forEach(clearTimeout);
  }, [hasPlayer, showSidePanel, updateScale]);

  return { updateScale };
}
