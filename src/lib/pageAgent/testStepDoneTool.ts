import { z } from 'zod/v4';
import { tool } from '@page-agent/core';

export const testStepDoneTool = tool({
  description: '完成当前测试步骤，并提交结构化测试结果。实际观察结果必须基于页面事实。',
  inputSchema: z.object({
    status: z.enum(['passed', 'failed', 'blocked']),
    actualResult: z.string().trim().min(1),
    detail: z.string().trim().min(1).optional(),
  }),
  execute: async (input) => {
    const text = JSON.stringify({
      status: input.status,
      actualResult: input.actualResult,
      ...(input.detail ? { detail: input.detail } : {}),
    });
    // PageAgent completes only through `done` and reads these fields after tool execution.
    Object.assign(input, { text, success: true });
    return '测试步骤结果已生成';
  },
});
