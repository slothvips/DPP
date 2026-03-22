// AI Tools - Tool registry and conversion utilities
import { browser } from 'wxt/browser';
import { logger } from '@/utils/logger';
import type { ToolParameter } from './types';

export const YOLO_MODE_KEY = '__dpp_yolo_mode';

/**
 * Tool execution handler type
 */
export type ToolHandler<T = unknown> = (args: unknown) => Promise<T>;

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
      logger.warn(`Tool ${tool.name} is already registered, overwriting...`);
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
   * Check if a tool requires confirmation (considers YOLO mode)
   */
  async requiresConfirmation(name: string): Promise<boolean> {
    // Check YOLO mode first
    const isYolo = await this.isYoloMode();
    if (isYolo) {
      return false;
    }

    const tool = this.tools.get(name);
    return tool?.requiresConfirmation ?? false;
  }

  /**
   * Check if YOLO mode is enabled
   */
  async isYoloMode(): Promise<boolean> {
    try {
      const result = await browser.storage.session.get(YOLO_MODE_KEY);
      return result[YOLO_MODE_KEY] === true;
    } catch {
      return false;
    }
  }

  /**
   * Set YOLO mode
   */
  async setYoloMode(enabled: boolean): Promise<void> {
    await browser.storage.session.set({ [YOLO_MODE_KEY]: enabled });
  }

  /**
   * Get list of tools that require confirmation (for prompt generation, not considering YOLO)
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
