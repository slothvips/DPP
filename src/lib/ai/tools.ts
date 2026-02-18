// AI Tools - Tool registry and conversion utilities
import type { AIToolDefinition, ToolParameter } from './types';

/**
 * Tool execution handler type
 */
export type ToolHandler<T = unknown> = (args: Record<string, unknown>) => Promise<T>;

/**
 * Tool metadata for registry
 */
export interface AIToolMetadata {
  name: string;
  description: string;
  parameters: ToolParameter;
  handler: ToolHandler;
  /** Whether this tool requires user confirmation before execution */
  requiresConfirmation?: boolean;
}

/**
 * Global tool registry
 */
class ToolRegistry {
  private tools: Map<string, AIToolMetadata> = new Map();

  /**
   * Register a tool
   */
  register(tool: AIToolMetadata): void {
    if (this.tools.has(tool.name)) {
      console.warn(`Tool ${tool.name} is already registered, overwriting...`);
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * Unregister a tool
   */
  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Get a tool by name
   */
  get(name: string): AIToolMetadata | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tools
   */
  getAll(): AIToolMetadata[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get all tools as AIToolDefinition format for AI
   */
  getToolDefinitions(): AIToolDefinition[] {
    return this.getAll().map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  /**
   * Execute a tool by name
   */
  async execute<T = unknown>(name: string, args: Record<string, unknown>): Promise<T> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool ${name} not found`);
    }
    return tool.handler(args) as Promise<T>;
  }

  /**
   * Check if a tool requires confirmation
   */
  requiresConfirmation(name: string): boolean {
    const tool = this.tools.get(name);
    return tool?.requiresConfirmation ?? false;
  }

  /**
   * Get list of tools that require confirmation
   */
  getConfirmationRequired(): string[] {
    return this.getAll()
      .filter((t) => t.requiresConfirmation)
      .map((t) => t.name);
  }

  /**
   * Clear all tools
   */
  clear(): void {
    this.tools.clear();
  }

  /**
   * Get tool count
   */
  get size(): number {
    return this.tools.size;
  }
}

/**
 * Global tool registry instance
 */
export const toolRegistry = new ToolRegistry();

/**
 * Convert tool definitions to Ollama format
 */
export function toOllamaTools(tools: AIToolDefinition[]): {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: ToolParameter;
  };
}[] {
  return tools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters,
    },
  }));
}

/**
 * Decorator to register a tool
 */
export function registerTool(
  tool: Omit<AIToolMetadata, 'handler'> & { handler: ToolHandler }
): void {
  toolRegistry.register(tool as AIToolMetadata);
}

/**
 * Helper to create tool parameter schema
 */
export function createToolParameter(
  properties: Record<string, { type: string; description: string; enum?: string[] }>,
  required: string[] = []
): ToolParameter {
  return {
    type: 'object',
    properties,
    required,
  };
}
