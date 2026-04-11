interface DraggableHost extends HTMLElement {
  _cleanupDrag?: () => void;
}

export function createRecorderFloatingUI(onStop: () => void) {
  let uiContainer: HTMLDivElement | null = null;
  let timerInterval: number | null = null;

  function mount(startTime: number) {
    if (uiContainer) return;

    const host = document.createElement('div');
    host.className = 'dpp-recorder-host rr-ignore';
    Object.assign(host.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: '2147483647',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    });

    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      .container {
        background: white;
        padding: 10px 14px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 10px;
        border: 1px solid #e5e7eb;
        font-size: 14px;
        color: #374151;
        cursor: move;
        user-select: none;
      }
      .indicator {
        display: flex;
        align-items: center;
        gap: 6px;
        pointer-events: none;
      }
      .dot {
        width: 8px;
        height: 8px;
        background: #ef4444;
        border-radius: 50%;
        animation: pulse 1.5s infinite;
      }
      .timer {
        font-variant-numeric: tabular-nums;
        font-weight: 500;
      }
      .stop-btn {
        background: #fee2e2;
        color: #b91c1c;
        border: 1px solid #fecaca;
        padding: 4px 10px;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 500;
        margin-left: 4px;
        transition: background 0.2s;
      }
      .stop-btn:hover {
        background: #fecaca;
      }
      @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.5; }
        100% { opacity: 1; }
      }
    `;

    const container = document.createElement('div');
    container.className = 'container';

    let isDragging = false;
    let currentX = 0;
    let currentY = 0;
    let initialX = 0;
    let initialY = 0;
    let xOffset = 0;
    let yOffset = 0;

    const setTranslate = (xPos: number, yPos: number, element: HTMLElement) => {
      element.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
    };

    const dragStart = (event: MouseEvent) => {
      if ((event.target as HTMLElement).tagName === 'BUTTON') return;
      initialX = event.clientX - xOffset;
      initialY = event.clientY - yOffset;
      isDragging = true;
    };

    const drag = (event: MouseEvent) => {
      if (!isDragging) return;
      event.preventDefault();
      currentX = event.clientX - initialX;
      currentY = event.clientY - initialY;
      xOffset = currentX;
      yOffset = currentY;
      setTranslate(currentX, currentY, host);
    };

    const dragEnd = () => {
      initialX = currentX;
      initialY = currentY;
      isDragging = false;
    };

    container.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);

    (host as DraggableHost)._cleanupDrag = () => {
      document.removeEventListener('mousemove', drag);
      document.removeEventListener('mouseup', dragEnd);
    };

    const indicator = document.createElement('div');
    indicator.className = 'indicator';

    const dot = document.createElement('div');
    dot.className = 'dot';

    const timer = document.createElement('span');
    timer.className = 'timer';
    timer.textContent = '00:00';

    indicator.appendChild(dot);
    indicator.appendChild(timer);

    const stopButton = document.createElement('button');
    stopButton.className = 'stop-btn';
    stopButton.textContent = 'Stop Recording';
    stopButton.onclick = (event) => {
      event.stopPropagation();
      onStop();
    };

    container.appendChild(indicator);
    container.appendChild(stopButton);
    shadow.appendChild(style);
    shadow.appendChild(container);

    document.body.appendChild(host);
    uiContainer = host as HTMLDivElement;

    timerInterval = window.setInterval(() => {
      const diff = Date.now() - startTime;
      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60)
        .toString()
        .padStart(2, '0');
      const remainSeconds = (seconds % 60).toString().padStart(2, '0');
      timer.textContent = `${minutes}:${remainSeconds}`;
    }, 1000);
  }

  function unmount() {
    if (uiContainer) {
      const host = uiContainer as DraggableHost;
      host._cleanupDrag?.();
      uiContainer.remove();
      uiContainer = null;
    }

    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  return { mount, unmount };
}
