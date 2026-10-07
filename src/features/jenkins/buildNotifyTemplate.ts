/* eslint-disable no-irregular-whitespace -- 通知模板用全角空格对齐字段 */
const PREVIOUS_JENKINS_TEMPLATES = new Set([
  `<b>{结果}</b> · {环境}
<a href="{链接}">{任务} #{编号}</a>
触发 {触发}
原因 {原因}
开始 {开始}
耗时 {耗时}
节点 {节点}
参数 {参数}
变更 {变更}
产物 {产物}
说明 {说明}
标签 {标签}`,
  `<b>{结果}</b> · {环境}
<a href="{链接}">{任务} #{编号}</a>
触发 {触发}
原因 {原因}
开始 {开始}
耗时 {耗时}
节点 {节点}
参数 {参数}
变更 {变更}
产物 {产物}
说明 {说明}
标签 {标签}
<pre>{日志}</pre>`,
  `<b>{结果}</b> · {环境}
<a href="{链接}"><b>{任务} #{编号}</b></a>
触发 <b>{触发}</b>
原因 {原因}
开始 <code>{开始}</code> · 耗时 <b>{耗时}</b>
节点 <code>{节点}</code>
<b>参数</b>
{参数}
<b>变更</b>
{变更}
产物 {产物}
说明 <i>{说明}</i>
标签 {标签}`,
  `<b>{结果}</b> · {环境}
<a href="{链接}"><b>{任务} #{编号}</b></a>
<blockquote>👤 <b>{触发}</b>
⏱ <b>{耗时}</b>
🕐 <code>{开始}</code>
🖥 <code>{节点}</code>
💬 {原因}
</blockquote>
⚙ {参数}
🔀 {变更}
📦 {产物}
📝 <i>{说明}</i>
🏷 {标签}`,
  `<b>{结果}</b>
<a href="{链接}"><b>{任务} #{编号}</b></a>
<blockquote>环境　<b>{环境}</b>
地址　<code>{地址}</code>
触发　<b>{触发}</b>
耗时　<b>{耗时}</b>
开始　<code>{开始}</code>
节点　<code>{节点}</code>
原因　{原因}
参数　{参数}
变更　{变更}
产物　{产物}
说明　<i>{说明}</i>
标签　{标签}
</blockquote>`,
  `<b>{结果}</b>
<a href="{链接}"><b>🔨 {任务} #{编号}</b></a>
<blockquote>🏗 环境　<b>{环境}</b>
🌐 地址　<code>{地址}</code>
👤 触发　<b>{触发}</b>
⏱ 耗时　<b>{耗时}</b>
🕐 开始　<code>{开始}</code>
🖥 节点　<code>{节点}</code>
💬 原因　{原因}
⚙ 参数　{参数}
🔀 变更　{变更}
📦 产物　{产物}
📝 说明　<i>{说明}</i>
🏷 标签　{标签}
</blockquote>`,
  `<b>{结果}</b>
<a href="{链接}"><b>🔨 {任务} #{编号}</b></a>
<blockquote>🏗 环境　<b>{环境}</b>
🌐 地址　<code>{地址}</code>
👤 触发　<b>{触发}</b>
⏱ 耗时　<b>{耗时}</b>
🕐 开始　<code>{开始}</code>
🖥 节点　<code>{节点}</code>
💬 原因　{原因}
💥 错误　{错误}
⚙ 参数　{参数}
🔀 变更　{变更}
📦 产物　{产物}
📝 说明　<i>{说明}</i>
🏷 标签　{标签}
</blockquote>`,
  `<b>{结果}</b>
<a href="{链接}"><b>🔨 {任务} #{编号}</b></a>
<blockquote>🏗 环境　<b>{环境}</b>
🌐 地址　<code>{地址}</code>
👤 触发　<b>{触发}</b>
⏱ 耗时　<b>{耗时}</b>
🕐 开始　<code>{开始}</code>
🖥 节点　<code>{节点}</code>
💬 原因　{原因}
💥 错误　{错误}
⚙ 参数　{参数}
🔀 变更　{变更}
📦 产物　{产物}
📝 说明　<i>{说明}</i>
🏷 标签　{标签}
</blockquote>
🔗 <a href="{链接}">打开这次构建</a>`,
  `<b>{结果}</b>
<a href="{链接}"><b>🔨 {任务} #{编号}</b></a>
<blockquote>🏗 环境　<b>{环境}</b>
🌐 地址　<code>{地址}</code>
👤 触发　<b>{触发}</b>
⏱ 耗时　<b>{耗时}</b>
🕐 开始　<code>{开始}</code>
🖥 节点　<code>{节点}</code>
💬 原因　{原因}
💥 错误　{错误}
⚙ 参数　{参数}
🔀 变更　{变更}
📦 产物　{产物}
📝 说明　<i>{说明}</i>
🏷 标签　{标签}
</blockquote>
<a href="{链接}">🔗 打开这次构建</a>`,
  `<b>{结果}</b>
<a href="{链接}"><b>🔨 {任务} #{编号}</b></a>
<blockquote>🏗 环境　<b>{环境}</b>
🌐 地址　<code>{地址}</code>
👤 触发　<b>{触发}</b>
⏱ 耗时　<b>{耗时}</b>
🕐 开始　<code>{开始}</code>
🖥 节点　<code>{节点}</code>
💬 原因　{原因}
💥 错误　{错误}
⚙ 参数　{参数}
🔀 变更　{变更}
📦 产物　{产物}
📝 说明　<i>{说明}</i>
🏷 标签　{标签}
</blockquote>`,
  `<b>{结果}</b>
<a href="{链接}"><b>🔨 {任务} #{编号}</b></a>
<blockquote>🏗 环境　<b>{环境}</b>
🌐 地址　<code>{地址}</code>
👤 触发　<b>{触发}</b>
⏱ 耗时　<b>{耗时}</b>
🕐 开始　<code>{开始}</code>
🖥 节点　<code>{节点}</code>
💬 来源　{原因}
💥 错误　{错误}
⚙ 参数　{参数}
🔀 变更　{变更}
📦 产物　{产物}
📝 说明　<i>{说明}</i>
🏷 标签　{标签}
</blockquote>`,
  `<b>{结果}</b>
<a href="{链接}"><b>🔨 {任务} #{编号}</b></a>
<blockquote>🏗 环境　<b>{环境}</b>
🌐 地址　<code>{地址}</code>
👤 触发　<b>{触发}</b>
⏱ 耗时　<b>{耗时}</b>
🕐 开始　<code>{开始}</code>
🖥 节点　<code>{节点}</code>
💬 来源　{原因}
💥 错误　{错误}
⚙ 参数　{参数}
🔀 变更　{变更}
📦 产物　{产物}
📝 说明　<i>{说明}</i>
🏷 标签　{标签}
💻 本机　<code>{客户端}</code>
</blockquote>`,
  `<b>{结果}</b>
<a href="{链接}"><b>🔨 {任务} #{编号}</b></a>
<blockquote>🏗 环境　<b>{环境}</b>
🌐 地址　<code>{地址}</code>
👤 触发　<b>{触发}</b>
⏱ 耗时　<b>{耗时}</b>
🕐 开始　<code>{开始}</code>
🖥 节点　<code>{节点}</code>
💬 来源　{原因}
💥 错误　{错误}
⚙ 参数　{参数}
🔀 变更　{变更}
📦 产物　{产物}
📝 说明　<i>{说明}</i>
🏷 标签　{标签}
💻 客户端　<code>{客户端}</code>
</blockquote>`,
  `<b>{结果}</b>
<a href="{链接}"><b>🔨 {任务} #{编号}</b></a>
<blockquote>🏗 环境　<b>{环境}</b>
🌐 地址　<code>{地址}</code>
👤 触发　<b>{触发}</b>
⏱ 耗时　<b>{耗时}</b>
🕐 开始　<code>{开始}</code>
🖥 节点　<code>{节点}</code>
💬 来源　{原因}
💥 错误　{错误}
⚙ 参数　{参数}
🔀 变更　{变更}
📦 产物　{产物}
📝 说明　<i>{说明}</i>
🏷 标签　{标签}
💻 通知发出者　<code>{通知发出者}</code>
</blockquote>`,
  `<b>{结果}</b>
<a href="{链接}"><b>🔨 {任务} #{编号}</b></a>
<blockquote>🏗 环境　<b>{环境}</b>
🌐 地址　<code>{地址}</code>
👤 触发　<b>{触发}</b>
⏱ 耗时　<b>{耗时}</b>
🕐 开始　<code>{开始}</code>
🖥 节点　<code>{节点}</code>
💬 来源　{原因}
💥 错误　{错误}
⚙ 参数　{参数}
🔀 变更　{变更}
📦 产物　{产物}
📝 说明　<i>{说明}</i>
🏷 标签　{标签}
💻 通知发出者　<code>{发出者}</code>
</blockquote>`,
  `<b>{结果}</b>
<a href="{链接}"><b>🔨 {任务} #{编号}</b></a>
<blockquote>🏗 环境　<b>{环境}</b>
🌐 地址　<code>{地址}</code>
🏷 标签　{标签}
👤 触发　<b>{触发}</b>
⏱ 耗时　<b>{耗时}</b>
🕐 开始　<code>{开始}</code>
🖥 节点　<code>{节点}</code>
💬 来源　{原因}
💥 错误　{错误}
⚙ 参数　{参数}
🔀 变更　{变更}
📦 产物　{产物}
📝 说明　<i>{说明}</i>
💻 通知发出者　<code>{发出者}</code>
</blockquote>`,
]);

/** Jenkins 构建通知自己的模板。图标加短标签，全角空格对齐。设置页里的消息正文不读这里。 */
export const JENKINS_BUILD_NOTIFY_TEMPLATE = `<b>{结果}</b>
<a href="{链接}"><b>🔨 {任务} #{编号}</b></a>
<blockquote>🏗 环境　<b>{环境}</b>
🌐 地址　<code>{地址}</code>
🏷 DPP标签　{标签}
👤 触发　<b>{触发}</b>
⏱ 耗时　<b>{耗时}</b>
🕐 开始　<code>{开始}</code>
🖥 节点　<code>{节点}</code>
💬 来源　{原因}
💥 错误　{错误}
⚙ 参数　{参数}
🔀 变更　{变更}
📦 产物　{产物}
📝 说明　<i>{说明}</i>
💻 通知发出者　<code>{发出者}</code>
</blockquote>`;

export function jenkinsBuildTemplateSource(template: string): string {
  const trimmed = template.trim();
  if (!trimmed || PREVIOUS_JENKINS_TEMPLATES.has(trimmed)) return JENKINS_BUILD_NOTIFY_TEMPLATE;
  return trimmed;
}
