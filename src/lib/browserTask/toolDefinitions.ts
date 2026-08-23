import type { OpenAIToolDefinition, ToolParameter, ToolProperty } from '@/lib/ai/types';

const INDEX: ToolProperty = {
  type: 'integer',
  minimum: 0,
  description: '观察结果中的元素 index',
};
const LOCAL_INDEX: ToolProperty = {
  ...INDEX,
  description: '可选。观察结果中带有 scroll 信息的元素 index 用于局部滚动；省略时滚动整个页面',
};
const TEXT: ToolProperty = { type: 'string', description: '文本内容', maxLength: 12000 };

function parameters(
  properties: Record<string, ToolProperty> = {},
  required: string[] = []
): ToolParameter {
  return { type: 'object', properties, required, additionalProperties: false };
}

function tool(
  name: string,
  description: string,
  schema: ToolParameter = parameters()
): OpenAIToolDefinition {
  return { type: 'function', function: { name, description, parameters: schema } };
}

export function createBrowserTaskTools(visionEnabled = false): OpenAIToolDefinition[] {
  const tools = [
    tool(
      'browser_observe',
      '重新观察当前页面并返回最新完整浏览器状态。页面仍在加载、上一步结果异常、页面发生变化、需要重新获取元素 index 或当前目标不明确时调用；状态明确时不要为了重复确认而调用。快照顶层 scroll 表示页面滚动状态；元素上的 scroll 表示其所在的局部滚动区域，局部滚动时传该元素 index。'
    ),
    tool('browser_click', '点击观察结果中的元素。', parameters({ index: INDEX }, ['index'])),
    tool(
      'browser_fill',
      '填写输入字段。',
      parameters({ index: INDEX, text: TEXT }, ['index', 'text'])
    ),
    tool(
      'browser_select',
      '按明确的文本或值选择原生下拉框选项。',
      parameters(
        {
          index: INDEX,
          option: { ...TEXT, description: '选项文本或 value' },
          matchBy: {
            type: 'string',
            enum: ['text', 'value'],
            description: '按 text 或 value 精确匹配',
          },
        },
        ['index', 'option', 'matchBy']
      )
    ),
    tool(
      'browser_scroll',
      '按一屏的尺寸向上、下、左或右滚动；传入带 scroll 信息的元素 index 可滚动局部区域。',
      parameters(
        {
          direction: {
            type: 'string',
            enum: ['up', 'down', 'left', 'right'],
            description: '滚动方向',
          },
          index: LOCAL_INDEX,
        },
        ['direction']
      )
    ),
    tool(
      'browser_scroll_page',
      '按视口或局部容器尺寸翻页式滚动；传入带 scroll 信息的元素 index 可滚动局部区域，支持上下左右。',
      parameters(
        {
          direction: {
            type: 'string',
            enum: ['up', 'down', 'left', 'right'],
            description: '滚动方向',
          },
          index: LOCAL_INDEX,
        },
        ['direction']
      )
    ),
    tool('browser_scroll_to_top', '滚动到顶部。', parameters({ index: LOCAL_INDEX })),
    tool('browser_scroll_to_bottom', '滚动到底部。', parameters({ index: LOCAL_INDEX })),
    tool(
      'browser_scroll_to_percent',
      '滚动到指定百分比位置。',
      parameters(
        {
          percent: { type: 'number', minimum: 0, maximum: 100, description: '0-100 的百分比' },
          index: LOCAL_INDEX,
        },
        ['percent']
      )
    ),
    tool(
      'browser_scroll_to_text',
      '滚动到第 nth 个包含指定文本的可见位置。',
      parameters(
        {
          text: { ...TEXT, description: '要查找的文本' },
          nth: { type: 'integer', minimum: 1, maximum: 100, description: '第几个可见匹配，默认 1' },
        },
        ['text']
      )
    ),
    tool('browser_send_keys', '向当前页面发送按键或组合键。', parameters({ keys: TEXT }, ['keys'])),
    tool(
      'browser_get_dropdown_options',
      '获取下拉框全部选项及其文本和值。',
      parameters({ index: INDEX }, ['index'])
    ),
    tool(
      'browser_navigate',
      '在当前标签页导航到 HTTP/HTTPS URL。',
      parameters({ url: { ...TEXT, description: '完整 URL' } }, ['url'])
    ),
    tool(
      'browser_open_tab',
      '打开并切换到新的任务标签页。',
      parameters({ url: { ...TEXT, description: '完整 URL' } }, ['url'])
    ),
    tool(
      'browser_switch_tab',
      '切换到任务跟踪的标签页。',
      parameters({ tabId: { type: 'integer', minimum: 1, description: '标签页 ID' } }, ['tabId'])
    ),
    tool(
      'browser_close_tab',
      '关闭任务期间创建的标签页。',
      parameters({ tabId: { type: 'integer', minimum: 1, description: '标签页 ID' } }, ['tabId'])
    ),
    tool('browser_go_back', '返回上一页。'),
    tool('browser_go_forward', '前进到下一页。'),
    tool('browser_refresh', '刷新当前页面。'),
    tool(
      'browser_wait',
      '等待页面异步变化；仅在确有等待依据时使用。',
      parameters({
        seconds: { type: 'integer', minimum: 1, maximum: 10, description: '等待秒数，默认 3' },
      })
    ),
    tool(
      'browser_request_user',
      '暂停任务，请求用户完成登录、验证码、权限审批或文件选择。',
      parameters({ reason: { ...TEXT, description: '需要用户完成的具体操作' } }, ['reason'])
    ),
    tool(
      'browser_done',
      '报告当前传入子任务已验证的结果并提交上级 D 仔复核；不要声称整个父任务已经完成。',
      parameters({ result: { ...TEXT, description: '已验证的最终结果' } }, ['result'])
    ),
  ];
  if (visionEnabled) {
    tools.splice(
      1,
      0,
      tool(
        'browser_observe_visual',
        '仅在最新 DOM 信息无法判断布局、遮挡、视觉控件或元素关系时获取带元素标记的当前视口截图；DOM 信息足够时不要调用。'
      )
    );
  }
  return tools;
}
