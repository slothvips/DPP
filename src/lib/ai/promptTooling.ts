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
          const requiredMark = required.includes(name) ? ' (required)' : ' (optional)';
          const enumStr = prop.enum ? ` (one of: ${prop.enum.join(', ')})` : '';
          return `  - ${name}${requiredMark}: ${prop.description}${enumStr}`;
        })
        .join('\n');

      return `### ${tool.name}
${tool.description}
${properties ? `Parameters:\n${properties}` : 'Parameters: none'}`;
    })
    .join('\n\n');
}

export function getPromptConfirmationSection(): string {
  const confirmationRequired = toolRegistry.getConfirmationRequired();
  return confirmationRequired.length > 0
    ? confirmationRequired.map((name) => `- ${name}`).join('\n')
    : '- (none)';
}

export function buildPromptToolingSection({
  toolDescriptions,
  confirmationSection,
}: {
  toolDescriptions: string;
  confirmationSection: string;
}): string {
  return `## Tool Usage

You can call tools through the model API's native tool calling mechanism.
Do NOT print fake JSON tool calls in markdown or code blocks.
When a tool is needed, emit a real tool call through the API.
When no tool is needed, answer normally in Markdown.

## Available Tools

${toolDescriptions}

## Tool Usage Rules

**Query operations** (no confirmation needed):
- list, get, search, export operations
- Examples: links_list, jenkins_list_jobs, tags_list, recorder_list, hotnews_get

**Operations requiring confirmation** (user must confirm before execution):
${confirmationSection}

If a confirming operation is needed, you may still request the tool call directly. The client will handle confirmation before execution.`;
}
