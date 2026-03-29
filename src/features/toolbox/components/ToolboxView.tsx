import { Box, Clock, ExternalLink, FileBraces, FileDiff, Regex } from 'lucide-react';
import { useState } from 'react';
import { JsonView } from './JsonTool/JsonView';
import { RegexView } from './RegexTool/RegexView';
import { TimestampView } from './TimestampTool/TimestampView';

// 工具类型定义：区分内部工具和外链工具
type InternalToolId = 'diff' | 'json' | 'regex' | 'timestamp' | 'tree-diff';
type ExternalToolId = 'react-playground' | 'vue-playground';

// 内部工具：在扩展内运行
interface InternalTool {
  id: InternalToolId;
  name: string;
  icon: React.ReactNode;
  description: string;
  openInNewTab: boolean;
}

// 外链工具：跳转到外部网站
interface ExternalTool {
  id: ExternalToolId;
  name: string;
  icon: React.ReactNode;
  description: string;
  url: string;
}

type Tool = InternalTool | ExternalTool;

// 内部嵌入视图的工具ID（不打开新标签页）
type EmbeddedToolId = 'json' | 'regex' | 'timestamp';

// 新标签页打开的工具ID与页面路径映射
const PAGE_MAP: Record<InternalToolId, string | undefined> = {
  diff: '/diff.html',
  'tree-diff': '/tree-diff.html',
  json: undefined,
  regex: undefined,
  timestamp: undefined,
};

const tools: Tool[] = [
  {
    id: 'diff',
    name: '文本差异对比工具',
    icon: <FileDiff className="h-4 w-4" />,
    description: 'VSCode 同款',
    openInNewTab: true,
  },
  {
    id: 'json',
    name: 'JSON 编辑器',
    icon: <FileBraces className="h-4 w-4" />,
    description: '格式化、压缩、验证',
    openInNewTab: false,
  },
  {
    id: 'regex',
    name: '正则表达式测试器',
    icon: <Regex className="h-4 w-4" />,
    description: '实时匹配测试',
    openInNewTab: false,
  },
  {
    id: 'timestamp',
    name: '时间戳转换器',
    icon: <Clock className="h-4 w-4" />,
    description: '时间戳与日期互转',
    openInNewTab: false,
  },
  {
    id: 'tree-diff',
    name: '树形数据对比',
    icon: <FileDiff className="h-4 w-4" />,
    description: '树形/扁平数据对比',
    openInNewTab: true,
  },
  {
    id: 'react-playground',
    name: 'React Playground',
    icon: <Box className="h-4 w-4" />,
    description: 'CodeSandbox 在线编辑器',
    url: 'https://codesandbox.io/s/new',
  },
  {
    id: 'vue-playground',
    name: 'Vue Playground',
    icon: <Box className="h-4 w-4" />,
    description: 'Vue 官方在线编辑器',
    url: 'https://play.vuejs.org/',
  },
];

export function ToolboxView() {
  const [activeTool, setActiveTool] = useState<EmbeddedToolId | null>(null);

  const handleClick = (tool: Tool) => {
    if ('url' in tool) {
      // 外链工具：打开外部网站
      chrome.tabs.create({ url: tool.url });
    } else if (tool.openInNewTab) {
      // 内部工具在新标签页打开
      const pagePath = PAGE_MAP[tool.id];
      if (pagePath) {
        const url = chrome.runtime.getURL(pagePath);
        chrome.tabs.create({ url });
      }
    } else {
      // 内部嵌入视图（类型断言：此时 tool.id 一定是 EmbeddedToolId）
      setActiveTool(tool.id as EmbeddedToolId);
    }
  };

  if (activeTool === 'regex') {
    return <RegexView onBack={() => setActiveTool(null)} />;
  }

  if (activeTool === 'timestamp') {
    return <TimestampView onBack={() => setActiveTool(null)} />;
  }

  if (activeTool === 'json') {
    return <JsonView onBack={() => setActiveTool(null)} />;
  }

  return (
    <div className="flex flex-col h-full p-4" data-testid="toolbox-view">
      <div className="mb-6">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Box className="h-5 w-5" />
          游乐园
        </h2>
        <p className="text-sm text-muted-foreground mt-1">选择一个项目开始使用</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => handleClick(tool)}
            className="flex flex-col items-start gap-3 p-4 rounded-lg border bg-card text-card-foreground hover:bg-accent hover:text-accent-foreground transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center p-2 rounded-md bg-primary/10 text-primary">
                {tool.icon}
              </div>
              <span className="font-medium">{tool.name}</span>
              {('url' in tool || ('openInNewTab' in tool && tool.openInNewTab)) && (
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
              )}
            </div>
            <p className="text-sm text-muted-foreground">{tool.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
