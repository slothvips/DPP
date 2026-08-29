import { z } from 'zod/v4';
import { tool } from '@page-agent/core';

export interface PageAgentTestStepResult {
  status: 'passed' | 'failed' | 'blocked';
  actualResult: string;
  detail?: string;
}

export function createTestStepDoneTool(onDone: (result: PageAgentTestStepResult) => void) {
  return tool({
    description: '完成当前测试步骤，并提交结构化测试结果。实际观察结果必须基于页面事实。',
    inputSchema: z.object({
      status: z.enum(['passed', 'failed', 'blocked']),
      actualResult: z.string().trim().min(1),
      detail: z.string().trim().min(1).optional(),
    }),
    execute: async (input) => {
      const result: PageAgentTestStepResult = {
        status: input.status,
        actualResult: input.actualResult,
        ...(input.detail ? { detail: input.detail } : {}),
      };
      onDone(result);
      Object.assign(input, { text: input.actualResult, success: true });
      return '测试步骤结果已生成';
    },
  });
}

// Kept for consumers that only need schema validation in tests and integrations.
export const testStepDoneTool = createTestStepDoneTool(() => undefined);
