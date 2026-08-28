import type { TestStepResult } from '@/features/aiAssistant/materials/testCaseTypes';
import { createToolParameter, toolRegistry } from '@/lib/ai/tools';
import type { ToolHandler } from '@/lib/ai/tools';
import {
  findActiveTestRunForSession,
  finishTestRun,
  setTestRunCurrentStep,
  startTestRun,
  updateTestRunStep,
} from '@/lib/db';
import { logger } from '@/utils/logger';
import { releaseTestBrowserTabs } from './browserTask';

const STEP_STATUSES = ['passed', 'failed', 'blocked', 'skipped'] as const;
const RUN_STATUSES = ['passed', 'failed', 'blocked', 'stopped'] as const;
const activeRunIdsBySession = new Map<string, string>();

export function registerTestRunTools(): void {
  toolRegistry.register({
    name: 'test_run_start',
    description: '为一个 ready 状态的测试用例创建新的共享执行记录并保存测试定义快照。',
    parameters: createToolParameter(
      { test_case_id: { type: 'string', description: '测试用例 ID' } },
      ['test_case_id']
    ),
    handler: (async (args: unknown) => {
      const sessionId = readOptionalSessionId(args);
      if (sessionId) {
        const activeRunId = activeRunIdsBySession.get(sessionId);
        const persistedRun = activeRunId ? undefined : await findActiveTestRunForSession(sessionId);
        if (persistedRun) activeRunIdsBySession.set(sessionId, persistedRun.id);
        if (activeRunId || persistedRun) {
          throw new Error('当前 AI 会话已有测试执行正在进行');
        }
      }
      const testCaseId = readText(readRecord(args).test_case_id, '测试用例 ID');
      const run = await startTestRun(testCaseId, sessionId);
      rememberActiveRun(args, run.id);
      return {
        success: true,
        run_id: run.id,
        status: run.status,
        test_case_version: run.testCaseVersion,
      };
    }) as ToolHandler,
  });

  toolRegistry.register({
    name: 'test_run_update_step',
    description: '保存测试执行当前步骤或刚完成的一个步骤结果；每个步骤完成后立即调用。',
    parameters: createToolParameter(
      {
        run_id: { type: 'string', description: '测试执行记录 ID' },
        current_step_id: {
          type: 'string',
          description:
            '开始步骤时填写当前步骤 ID；保存非阻塞结果时填写紧邻的下一步骤 ID；阻塞结果不要填写',
        },
        step_id: { type: 'string', description: '刚完成的步骤 ID' },
        order: { type: 'integer', minimum: 0, description: '刚完成的步骤顺序' },
        status: { type: 'string', enum: [...STEP_STATUSES], description: '步骤结果状态' },
        actual_result: {
          type: 'string',
          description: '自然语言实际观察结果，不要回显密码或 Token',
        },
        detail: { type: 'string', description: '步骤补充说明，不要回显敏感数据' },
        agent_result: {
          type: 'string',
          description: '网页子 Agent 返回的原始受限 JSON；传入后由 DPP 校验并优先使用其中结果',
        },
      },
      ['run_id']
    ),
    handler: (async (args: unknown) => {
      const record = readRecord(args);
      const runId = readText(record.run_id, '执行记录 ID');
      const currentStepId = optionalText(record.current_step_id);
      const stepId = optionalText(record.step_id);
      if (!stepId) {
        if (!currentStepId) throw new Error('需要 current_step_id 或完整步骤结果');
        const run = await setTestRunCurrentStep(runId, currentStepId);
        return {
          success: true,
          run_id: run.id,
          status: run.status,
          current_step_id: currentStepId,
        };
      }

      const parsedAgentResult = optionalText(record.agent_result);
      const agentResult = parsedAgentResult ? parseAgentResult(parsedAgentResult) : undefined;
      const result: TestStepResult = {
        stepId,
        order: readInteger(record.order, '步骤顺序'),
        status: agentResult?.status ?? readEnum(record.status, STEP_STATUSES, '步骤状态'),
        ...(agentResult?.actualResult
          ? { actualResult: agentResult.actualResult }
          : optionalMappedText(record.actual_result, 'actualResult')),
        ...(agentResult?.detail
          ? { detail: agentResult.detail }
          : optionalMappedText(record.detail, 'detail')),
      };
      const run = await updateTestRunStep(runId, {
        result,
        currentStepId: result.status === 'blocked' ? undefined : currentStepId,
      });
      return {
        success: true,
        run_id: run.id,
        status: run.status,
        ...(run.currentStepId ? { current_step_id: run.currentStepId } : {}),
        ...(run.currentStepIds ? { current_step_ids: run.currentStepIds } : {}),
      };
    }) as ToolHandler,
  });

  toolRegistry.register({
    name: 'test_run_finish',
    description: '保存最终测试报告并结束共享执行记录。passed 只能用于所有步骤均通过的执行。',
    parameters: createToolParameter(
      {
        run_id: { type: 'string', description: '测试执行记录 ID' },
        status: { type: 'string', enum: [...RUN_STATUSES], description: '最终执行状态' },
        summary: { type: 'string', description: '自然语言测试报告总结' },
        error: { type: 'string', description: '失败、阻塞或停止原因，可选' },
      },
      ['run_id', 'status', 'summary']
    ),
    handler: (async (args: unknown) => {
      const record = readRecord(args);
      const run = await finishTestRun(
        readText(record.run_id, '执行记录 ID'),
        readEnum(record.status, RUN_STATUSES, '最终执行状态'),
        readText(record.summary, '测试报告总结'),
        optionalText(record.error)
      );
      clearActiveRun(record, run.id);
      const sessionId = readOptionalSessionId(record);
      if (sessionId) releaseTestBrowserTabs(sessionId, run.id);
      return { success: true, run_id: run.id, status: run.status, finished_at: run.finishedAt };
    }) as ToolHandler,
  });
}

export function hasActiveTestRunForSession(sessionId: string): boolean {
  return activeRunIdsBySession.has(sessionId);
}

export async function stopTestRunForSession(sessionId: string, reason: string): Promise<void> {
  const persistedRun = activeRunIdsBySession.has(sessionId)
    ? undefined
    : await findActiveTestRunForSession(sessionId);
  const runId = activeRunIdsBySession.get(sessionId) ?? persistedRun?.id;
  if (!runId) return;

  try {
    await finishTestRun(runId, 'stopped', '测试执行已停止', reason);
  } catch (error) {
    logger.error('[TestRun] Failed to stop test run:', error);
  } finally {
    releaseTestBrowserTabs(sessionId, runId);
    if (activeRunIdsBySession.get(sessionId) === runId) {
      activeRunIdsBySession.delete(sessionId);
    }
  }
}

function rememberActiveRun(args: unknown, runId: string): void {
  const sessionId = readOptionalSessionId(args);
  if (sessionId) activeRunIdsBySession.set(sessionId, runId);
}

function clearActiveRun(args: Record<string, unknown>, runId: string): void {
  const sessionId = readOptionalSessionId(args);
  if (sessionId && activeRunIdsBySession.get(sessionId) === runId) {
    activeRunIdsBySession.delete(sessionId);
  }
}

function readOptionalSessionId(value: unknown): string | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const sessionId = (value as Record<string, unknown>).session_id;
  return typeof sessionId === 'string' && sessionId.trim() ? sessionId.trim() : undefined;
}

function readRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('测试执行参数必须是对象');
  }
  return value as Record<string, unknown>;
}

function readText(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label}不能为空`);
  return value.trim();
}

function optionalText(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  return readText(value, '文本参数');
}

function optionalMappedText(
  value: unknown,
  key: 'actualResult' | 'detail'
): Record<string, string> {
  const text = optionalText(value);
  return text ? { [key]: text } : {};
}

function readInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) throw new Error(`${label}必须是整数`);
  return value;
}

function parseAgentResult(value: string): {
  status: Extract<TestStepResult['status'], 'passed' | 'failed' | 'blocked'>;
  actualResult: string;
  detail?: string;
} {
  const normalized = value.trim().replace(/^\uFEFF/, '');
  const candidates = [normalized];
  const fenced = normalized.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced?.[1]) candidates.push(fenced[1]);

  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('对象无效');
      }
      const record = parsed as Record<string, unknown>;
      const status = readEnum(
        record.status,
        ['passed', 'failed', 'blocked'] as const,
        '网页步骤状态'
      );
      const actualResult = readText(record.actualResult, '网页实际结果');
      return {
        status,
        actualResult,
        ...optionalMappedText(record.detail, 'detail'),
      };
    } catch {
      // 只尝试受限格式，所有格式都失败时保留 blocked 语义。
    }
  }

  return {
    status: 'blocked',
    actualResult: '网页子 Agent 返回结果无法解析',
    detail: 'DPP 未收到合法的步骤结果 JSON，已阻塞当前测试执行',
  };
}

function readEnum<T extends readonly string[]>(
  value: unknown,
  values: T,
  label: string
): T[number] {
  if (typeof value !== 'string' || !values.includes(value)) throw new Error(`${label}无效`);
  return value as T[number];
}
