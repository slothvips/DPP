import { Box, Clock, FileBraces, FileDiff, type LucideIcon, Regex } from 'lucide-react';

export type InternalToolId = 'diff' | 'json' | 'regex' | 'timestamp' | 'tree-diff';
export type ExternalToolId = 'react-playground' | 'vue-playground';
export type EmbeddedToolId = 'json' | 'regex' | 'timestamp';

interface ToolboxBaseTool {
  id: InternalToolId | ExternalToolId;
  name: string;
  description: string;
  icon: LucideIcon;
}

export interface InternalTool extends ToolboxBaseTool {
  id: InternalToolId;
  type: 'internal';
  openInNewTab: boolean;
}

export interface ExternalTool extends ToolboxBaseTool {
  id: ExternalToolId;
  type: 'external';
  url: string;
}

export type ToolboxTool = InternalTool | ExternalTool;

export const TOOLBOX_PAGE_MAP: Partial<Record<InternalToolId, string>> = {
  diff: '/diff.html',
  'tree-diff': '/tree-diff.html',
};

export const TOOLBOX_TOOLS: ToolboxTool[] = [
  {
    id: 'diff',
    type: 'internal',
    name: '文本差异对比工具',
    icon: FileDiff,
    description: 'VSCode 同款',
    openInNewTab: true,
  },
  {
    id: 'json',
    type: 'internal',
    name: 'JSON 编辑器',
    icon: FileBraces,
    description: '格式化、压缩、验证',
    openInNewTab: false,
  },
  {
    id: 'regex',
    type: 'internal',
    name: '正则表达式测试器',
    icon: Regex,
    description: '实时匹配测试',
    openInNewTab: false,
  },
  {
    id: 'timestamp',
    type: 'internal',
    name: '时间戳转换器',
    icon: Clock,
    description: '时间戳与日期互转',
    openInNewTab: false,
  },
  {
    id: 'tree-diff',
    type: 'internal',
    name: '树形数据对比',
    icon: FileDiff,
    description: '树形/扁平数据对比',
    openInNewTab: true,
  },
  {
    id: 'react-playground',
    type: 'external',
    name: 'React Playground',
    icon: Box,
    description: 'CodeSandbox 在线编辑器',
    url: 'https://codesandbox.io/s/new',
  },
  {
    id: 'vue-playground',
    type: 'external',
    name: 'Vue Playground',
    icon: Box,
    description: 'Vue 官方在线编辑器',
    url: 'https://play.vuejs.org/',
  },
];

export function isEmbeddedToolId(id: InternalToolId): id is EmbeddedToolId {
  return id === 'json' || id === 'regex' || id === 'timestamp';
}

export function isExternalTool(tool: ToolboxTool): tool is ExternalTool {
  return tool.type === 'external';
}

export function showsExternalLink(tool: ToolboxTool): boolean {
  return tool.type === 'external' || tool.openInNewTab;
}
