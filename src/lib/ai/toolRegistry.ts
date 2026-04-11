import { logger } from '@/utils/logger';
import { type AIToolMetadata, toOpenAIToolDefinition } from './toolsShared';
import type { OpenAIToolDefinition } from './types';

export class ToolRegistry {
  private tools: Map<string, AIToolMetadata> = new Map();

  register(tool: AIToolMetadata): void {
    if (this.tools.has(tool.name)) {
      logger.warn(`Tool ${tool.name} is already registered, overwriting...`);
    }

    this.tools.set(tool.name, tool);
  }

  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  get(name: string): AIToolMetadata | undefined {
    return this.tools.get(name);
  }

  getAll(): AIToolMetadata[] {
    return Array.from(this.tools.values());
  }

  getOpenAITools(): OpenAIToolDefinition[] {
    return this.getAll().map(toOpenAIToolDefinition);
  }

  async execute<T = unknown>(name: string, args: Record<string, unknown>): Promise<T> {
    const trimmedName = name.trim();
    const tool = this.tools.get(trimmedName);
    if (!tool) {
      throw new Error(`Tool ${trimmedName} not found`);
    }

    return tool.handler(args) as Promise<T>;
  }

  requiresConfirmation(name: string): boolean {
    return this.tools.get(name)?.requiresConfirmation ?? false;
  }

  getConfirmationRequired(): string[] {
    return this.getAll()
      .filter((tool) => tool.requiresConfirmation)
      .map((tool) => tool.name);
  }

  clear(): void {
    this.tools.clear();
  }

  get size(): number {
    return this.tools.size;
  }
}

export const toolRegistry = new ToolRegistry();
