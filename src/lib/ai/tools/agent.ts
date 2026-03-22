// Agent control AI tools - 控制 AI 助手行为
import { createToolParameter, toolRegistry } from '../tools';
import type { ToolHandler } from '../tools';

/**
 * 设置 YOLO 模式 - 跳过工具执行的确认步骤
 */
async function agent_setYoloMode(args: { enabled: boolean }): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    await toolRegistry.setYoloMode(args.enabled);
    return {
      success: true,
      message: args.enabled
        ? 'YOLO 模式已开启，工具执行将不再需要确认'
        : 'YOLO 模式已关闭，工具执行需要确认',
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '设置 YOLO 模式失败',
    };
  }
}

/**
 * 获取当前 YOLO 模式状态
 */
async function agent_getYoloMode(): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const enabled = await toolRegistry.isYoloMode();
    return {
      success: true,
      message: enabled ? 'YOLO 模式：开启' : 'YOLO 模式：关闭',
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '获取 YOLO 模式状态失败',
    };
  }
}

// Export functions for testing
export { agent_setYoloMode, agent_getYoloMode };

/**
 * Register all agent control tools
 */
export function registerAgentTools(): void {
  // YOLO 模式开关
  toolRegistry.register({
    name: 'agent_setYoloMode',
    description: '开启或关闭 YOLO 模式。YOLO 模式下，工具执行无需用户确认，直接执行。',
    parameters: createToolParameter(
      {
        enabled: {
          type: 'boolean',
          description: '是否开启 YOLO 模式：true 开启，false 关闭',
        },
      },
      ['enabled']
    ),
    handler: agent_setYoloMode as ToolHandler,
  });

  // 获取 YOLO 模式状态
  toolRegistry.register({
    name: 'agent_getYoloMode',
    description: '获取当前 YOLO 模式的开启状态',
    parameters: createToolParameter({}, []),
    handler: agent_getYoloMode as ToolHandler,
  });
}
