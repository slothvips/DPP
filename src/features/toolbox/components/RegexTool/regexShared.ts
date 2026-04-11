export interface MatchGroup {
  name?: string;
  value: string;
  index: number;
}

export interface MatchResult {
  match: string;
  index: number;
  groups: MatchGroup[];
}

export interface HighlightPart {
  text: string;
  highlighted: boolean;
}

export interface RegexPreset {
  label: string;
  pattern: string;
  flag?: RegexFlagKey;
  desc: string;
}

export const REGEX_FLAGS = [
  { key: 'g', label: 'g', title: '全局匹配' },
  { key: 'i', label: 'i', title: '不区分大小写' },
  { key: 'm', label: 'm', title: '多行模式' },
  { key: 's', label: 's', title: '点号匹配换行' },
  { key: 'u', label: 'u', title: 'Unicode' },
] as const;

export type RegexFlagKey = (typeof REGEX_FLAGS)[number]['key'];
export type RegexFlags = Record<RegexFlagKey, boolean>;

export const REGEX_PRESETS: RegexPreset[] = [
  { label: '手机号', pattern: '1[3-9]\\d{9}', flag: 'g', desc: '中国大陆手机号' },
  { label: '邮箱', pattern: '[\\w.-]+@[\\w.-]+\\.\\w+', flag: 'g', desc: '电子邮箱地址' },
  { label: 'URL', pattern: 'https?://\\S+', flag: 'g', desc: '网页链接' },
  {
    label: 'IP 地址',
    pattern: '\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}',
    flag: 'g',
    desc: 'IPv4 地址',
  },
  {
    label: '日期',
    pattern: '\\d{4}[-/年]\\d{1,2}[-/月]\\d{1,2}[日]?',
    flag: 'g',
    desc: '日期格式（简化版，可能匹配无效日期）',
  },
  {
    label: '时间',
    pattern: '\\d{1,2}:\\d{2}(:\\d{2})?',
    flag: 'g',
    desc: '时间格式 HH:mm:ss',
  },
  {
    label: '身份证',
    pattern: '[1-9]\\d{5}(19|20)\\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\\d|3[01])\\d{3}[\\dXx]',
    desc: '中国大陆身份证号',
  },
  { label: '中文', pattern: '[\\u4e00-\\u9fa5]+', flag: 'g', desc: '中文字符' },
  { label: '数字', pattern: '-?\\d+(\\.\\d+)?', flag: 'g', desc: '整数或小数' },
  {
    label: 'HTML 标签',
    pattern: '<\\w+[^>]*>|</\\w+>',
    flag: 'g',
    desc: 'HTML 标签（简化版）',
  },
  { label: 'Hex 颜色', pattern: '#[0-9a-fA-F]{3,8}', flag: 'g', desc: '十六进制颜色值' },
  {
    label: 'UUID',
    pattern: '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}',
    flag: 'g',
    desc: 'UUID 格式',
  },
  {
    label: '端口号',
    pattern: '(?:[1-9]\\d{0,3}|[1-5]\\d{4}|6[0-4]\\d{3}|65[0-4]\\d{2}|655[0-2]\\d|6553[0-5])',
    flag: 'g',
    desc: '端口号 (1-65535)',
  },
  { label: '邮政编码', pattern: '[1-9]\\d{5}', flag: 'g', desc: '中国大陆邮政编码' },
];
