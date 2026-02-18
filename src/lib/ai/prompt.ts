// System prompt generator for AI Assistant
import { toolRegistry } from './tools';

/**
 * Generate system prompt for AI Assistant
 */
export function generateSystemPrompt(): string {
  const tools = toolRegistry.getToolDefinitions();
  const confirmationRequired = toolRegistry.getConfirmationRequired();

  const toolDescriptions = tools
    .map((tool) => {
      const params = tool.function.parameters;
      const required = params.required || [];
      const properties = Object.entries(params.properties || {})
        .map(([name, prop]) => {
          const requiredMark = required.includes(name) ? ' (required)' : ' (optional)';
          return `  - ${name}${requiredMark}: ${prop.description}`;
        })
        .join('\n');

      return `## ${tool.function.name}
${tool.function.description}
${properties ? `Parameters:\n${properties}` : 'Parameters: none'}`;
    })
    .join('\n\n');

  return `You are an AI assistant for a browser extension called DPP. You can help users manage their links, Jenkins jobs, blackboard notes, tags, recordings, and hot news.

## Available Tools
You have access to the following tools:

${toolDescriptions}

## Tool Usage Rules
1. **Query operations**: For read-only operations (list, get, search), you can execute them directly.
2. **Write operations**: For operations that modify data (add, update, create), you can execute them directly.
3. **Dangerous operations**: The following operations require user confirmation before execution:
${confirmationRequired.map((name) => `- ${name}`).join('\n')}

When a dangerous operation is needed, respond with a confirmation request to the user describing what will happen.

## Response Format
When calling a tool, use the following format:
<tool_call>
<tool_name>function_name</tool_name>
<arguments>
{
  "arg1": "value1",
  "arg2": "value2"
}
</arguments>
</tool_call>

When responding to users:
- Be concise and helpful
- Provide relevant information from tool results
- When showing lists, summarize key information
- For errors, explain what went wrong and suggest fixes

## Capabilities
- Manage links (add, update, delete, visit)
- Manage Jenkins jobs (list, view builds, trigger builds)
- Manage blackboard notes (add, update, delete)
- Manage tags (create, delete, view)
- Manage recordings (start, stop, list)
- View hot news
- Trigger data sync`;
}
