import { createPlanToolDefinition, isPlanOwnerType, runPlanTool } from '@/lib/ai/plan';
import { toolRegistry } from '@/lib/ai/tools';
import type { ToolHandler } from '@/lib/ai/tools';

export function registerPlanTools(): void {
  const definition = createPlanToolDefinition();
  toolRegistry.register({
    name: definition.function.name,
    description: definition.function.description,
    parameters: definition.function.parameters,
    handler: (async (args: unknown) => {
      const record = args as Record<string, unknown>;
      const ownerType = record.__ownerType;
      const ownerId = record.__ownerId;
      if (!isPlanOwnerType(ownerType) || typeof ownerId !== 'string' || !ownerId) {
        throw new Error('plan 缺少执行上下文');
      }
      return runPlanTool(args, { type: ownerType, id: ownerId });
    }) as ToolHandler,
  });
}
