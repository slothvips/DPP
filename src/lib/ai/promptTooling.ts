import { toolRegistry } from './tools';

type ToolProperty = {
  type: string;
  description: string;
  enum?: string[];
};

export function getPromptToolDescriptions(): string {
  const tools = toolRegistry.getAll();

  return tools
    .map((tool) => {
      const params = tool.parameters;
      const required = params.required || [];
      const properties = Object.entries(params.properties || {})
        .map(([name, prop]: [string, ToolProperty]) => {
          const requiredMark = required.includes(name) ? '（必填）' : '（可选）';
          const enumStr = prop.enum ? `（可选值：${prop.enum.join(', ')}）` : '';
          return `  - ${name}${requiredMark}：${prop.description}${enumStr}`;
        })
        .join('\n');

      return `### ${tool.name}
${tool.description}
${properties ? `参数：\n${properties}` : '参数：无'}`;
    })
    .join('\n\n');
}

export function getPromptConfirmationSection(): string {
  const confirmationRequired = toolRegistry.getConfirmationRequired();
  return confirmationRequired.length > 0
    ? confirmationRequired.map((name) => `- ${name}`).join('\n')
    : '- （无）';
}

export function buildPromptToolingSection({
  toolDescriptions,
  confirmationSection,
}: {
  toolDescriptions: string;
  confirmationSection: string;
}): string {
  return `## 工具使用

你可以通过模型 API 的原生 tool calling 机制调用工具。
不要在 Markdown 或代码块里输出伪造的 JSON 工具调用。
需要用工具时，直接通过 API 发出真实的 tool call。
不需要工具时，正常用 Markdown 回答。

## 可用工具

${toolDescriptions}

## 工具使用规则

工具是否需要确认，以工具定义中的确认标记为准，不要根据工具名称自行推断。
- 当前工具调用按请求顺序逐个执行；需要前一个工具结果才能决定参数或下一步时，等待结果返回后再调用下一个工具。

**需要确认的操作**（执行前必须由用户确认）：
${confirmationSection}

如果某个操作需要确认，你仍然可以直接请求对应的 tool call；客户端会在执行前处理确认流程。

配置与敏感数据：
- 不要主动索取、重复输出或泄露 API Key、同步 Token、加密密钥、Jenkins Token 等敏感信息。
- 除非用户明确要求修改，否则不要调用配置修改工具。
- 不要把敏感配置放入网页任务或普通回复。`;
}
