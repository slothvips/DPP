/** 通道试发正文。各功能模块不读这份。 */
export const DEFAULT_NOTIFY_TEMPLATE = 'DPP 通道测试';

export const NOTIFY_TEMPLATE_SAMPLE = {
  环境: '示例环境',
  地址: 'jenkins.example',
  任务: 'folder/demo',
  编号: '1',
  结果: 'SUCCESS',
  触发: '试发',
  原因: 'Started by user 试发',
  错误: 'script returned exit code 1',
  开始: '2026-01-02 11:04:05',
  耗时: '2分5秒',
  节点: 'agent-1',
  参数: 'BRANCH=main',
  变更: 'abc1234 fix',
  产物: 'app.jar',
  说明: '示例构建',
  链接: 'https://jenkins.example/job/folder/job/1/',
  标签: '#后端',
  发出者: 'Chrome · macOS · a1b2c3d4',
  日志: 'Finished: SUCCESS',
} as const;

export type NotifyTemplateVars = {
  环境: string;
  地址: string;
  任务: string;
  编号: string;
  结果: string;
  触发: string;
  原因: string;
  错误: string;
  开始: string;
  耗时: string;
  节点: string;
  参数: string;
  变更: string;
  产物: string;
  说明: string;
  链接: string;
  标签: string;
  发出者: string;
  日志: string;
};

export function notifyTemplateSource(template: string): string {
  const trimmed = template.trim();
  return trimmed || DEFAULT_NOTIFY_TEMPLATE;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const TELEGRAM_TEXT_MAX = 4000;

/** 空内容用默认格式。代入的值按 HTML 转义，不认识的 {名称} 原样留下。 */
export function renderNotifyTemplate(template: string, vars: NotifyTemplateVars): string {
  const values: Record<string, string> = vars;
  const rendered = notifyTemplateSource(template)
    .replace(/\{([^{}]+)\}/g, (token, key: string) =>
      Object.hasOwn(values, key) ? escapeHtml(values[key]) : token
    )
    .replace(/<pre>\s*<\/pre>\n?/g, '')
    .replace(/<blockquote[^>]*>\s*<\/blockquote>\n?/g, '')
    .trim();
  return rendered.length > TELEGRAM_TEXT_MAX
    ? `${rendered.slice(0, TELEGRAM_TEXT_MAX - 1)}…`
    : rendered;
}
