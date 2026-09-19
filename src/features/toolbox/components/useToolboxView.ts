import { useState } from 'react';
import { trackPlayground } from '@/lib/analytics';
import {
  type EmbeddedToolId,
  TOOLBOX_PAGE_MAP,
  type ToolboxTool,
  isEmbeddedToolId,
  isExternalTool,
} from './toolboxShared';

export function useToolboxView() {
  const [activeTool, setActiveTool] = useState<EmbeddedToolId | null>(null);

  const handleBack = () => {
    setActiveTool(null);
  };

  const handleSelectTool = (tool: ToolboxTool) => {
    trackPlayground('toolOpened', { meta: { tool: tool.id } });
    if (isExternalTool(tool)) {
      void chrome.tabs.create({ url: tool.url });
      return;
    }

    if (tool.openInNewTab) {
      const pagePath = TOOLBOX_PAGE_MAP[tool.id];
      if (pagePath) {
        void chrome.tabs.create({ url: chrome.runtime.getURL(pagePath) });
      }
      return;
    }

    if (isEmbeddedToolId(tool.id)) {
      setActiveTool(tool.id);
    }
  };

  return {
    activeTool,
    handleBack,
    handleSelectTool,
  };
}
