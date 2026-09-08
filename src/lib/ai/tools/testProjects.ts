import type {
  DecryptedTestProjectRun,
  TestRunStatus,
} from '@/features/aiAssistant/materials/testCaseTypes';
import { createToolParameter, toolRegistry } from '@/lib/ai/tools';
import type { ToolHandler } from '@/lib/ai/tools';
import {
  findActiveTestProjectRunForSession,
  findActiveTestRunForSession,
  finishTestProjectRun,
  finishTestRun,
  getTestProjectRun,
  startTestProjectRun,
  updateTestProjectRunItem,
} from '@/lib/db';
import { logger } from '@/utils/logger';
import { releaseTestBrowserTabs } from './browserTask';
import { executeTestRun } from './testRuns';

const TERMINAL_STATUSES = ['passed', 'failed', 'blocked', 'error', 'stopped'] as const;
const activeProjectRunIdsBySession = new Map<string, string>();

export function registerTestProjectTools(): void {
  toolRegistry.register({
    name: 'test_project_execute',
    description:
      '按项目固定快照和顺序串行执行全部已启用测试用例。单条失败、阻塞或技术错误后仍继续后续用例；整次项目执行只确认一次。',
    parameters: createToolParameter(
      { project_id: { type: 'string', description: '测试项目 ID' } },
      ['project_id']
    ),
    handler: executeTestProject as ToolHandler,
    requiresConfirmation: true,
  });

  toolRegistry.register({
    name: 'test_project_report',
    description: '读取一次测试项目执行快照、总体状态和每条子测试用例的执行结果。',
    parameters: createToolParameter(
      { project_run_id: { type: 'string', description: '项目执行记录 ID' } },
      ['project_run_id']
    ),
    handler: (async (args: unknown) =>
      createProjectExecutionResult(
        await requireProjectRun(readText(readRecord(args).project_run_id, '项目执行记录 ID'))
      )) as ToolHandler,
  });
}

async function executeTestProject(args: unknown): Promise<Record<string, unknown>> {
  const record = readRecord(args);
  const projectId = readText(record.project_id, '测试项目 ID');
  const sessionId = optionalText(record.session_id);
  const toolCallId = optionalText(record.tool_call_id) ?? crypto.randomUUID();
  if (sessionId && activeProjectRunIdsBySession.has(sessionId)) {
    throw new Error('当前 AI 会话已有测试项目正在执行');
  }
  const persisted = sessionId ? await findActiveTestProjectRunForSession(sessionId) : undefined;
  if (persisted && persisted.projectId !== projectId) {
    throw new Error('当前 AI 会话已有其他测试项目正在执行');
  }
  const projectRun = persisted
    ? await requireProjectRun(persisted.id)
    : await startTestProjectRun(projectId, sessionId);
  if (sessionId) activeProjectRunIdsBySession.set(sessionId, projectRun.id);

  try {
    for (const item of projectRun.content.testCases) {
      if (item.status === 'running') {
        if (sessionId) {
          const orphanedRun = await findActiveTestRunForSession(sessionId);
          if (orphanedRun) {
            await finishTestRun(
              orphanedRun.id,
              'stopped',
              '页面刷新中断了当前测试用例',
              '页面刷新中断了当前测试用例，已停止并继续执行后续用例'
            );
          }
        }
        await updateTestProjectRunItem(projectRun.id, item.testCaseMaterialId, {
          status: 'error',
          error: '页面刷新中断了当前测试用例，项目已继续执行后续用例',
        });
        continue;
      }
      if (item.status !== 'queued') continue;
      const latest = await requireProjectRun(projectRun.id);
      if (latest.status === 'stopped') return createProjectExecutionResult(latest);
      await updateTestProjectRunItem(projectRun.id, item.testCaseMaterialId, { status: 'running' });

      try {
        const result = await executeTestRun(
          {
            test_case_id: item.testCaseMaterialId,
            project_run_id: projectRun.id,
            test_tab_scope_id: projectRun.id,
            ...(sessionId ? { session_id: sessionId } : {}),
            tool_call_id: `${toolCallId}:${item.order}`,
          },
          item.testCaseSnapshot,
          item.testCaseVersion
        );
        const current = await requireProjectRun(projectRun.id);
        if (current.status === 'stopped') return createProjectExecutionResult(current);
        await updateTestProjectRunItem(projectRun.id, item.testCaseMaterialId, {
          status: readStatus(result.status),
          ...(typeof result.run_id === 'string' ? { testRunId: result.run_id } : {}),
          ...(typeof result.error === 'string' ? { error: result.error } : {}),
        });
      } catch (error) {
        logger.error('[TestProject] Test case execution failed:', error);
        const current = await requireProjectRun(projectRun.id);
        if (current.status === 'stopped') return createProjectExecutionResult(current);
        await updateTestProjectRunItem(projectRun.id, item.testCaseMaterialId, {
          status: 'error',
          error: sanitizeError(error),
        });
      }
    }

    await finishTestProjectRun(projectRun.id);
    return createProjectExecutionResult(await requireProjectRun(projectRun.id));
  } finally {
    releaseTestBrowserTabs(projectRun.id);
    if (sessionId && activeProjectRunIdsBySession.get(sessionId) === projectRun.id) {
      activeProjectRunIdsBySession.delete(sessionId);
    }
  }
}

function createProjectExecutionResult(run: DecryptedTestProjectRun): Record<string, unknown> {
  const completed = run.content.testCases.filter(
    (item) => item.status !== 'queued' && item.status !== 'running' && item.status !== 'skipped'
  ).length;
  return {
    success: run.status === 'passed' || run.status === 'failed',
    project_run_id: run.id,
    project_id: run.projectId,
    project_title: run.content.projectTitle,
    project_version: run.projectVersion,
    status: run.status,
    started_at: run.startedAt,
    finished_at: run.finishedAt,
    progress: {
      completed,
      total: run.content.testCases.filter((item) => item.status !== 'skipped').length,
    },
    test_cases: run.content.testCases.map((item) => ({
      test_case_id: item.testCaseMaterialId,
      test_case_version: item.testCaseVersion,
      title: item.title,
      order: item.order,
      test_run_id: item.testRunId,
      status: item.status,
      error: item.error,
    })),
  };
}

async function requireProjectRun(id: string): Promise<DecryptedTestProjectRun> {
  const run = await getTestProjectRun(id);
  if (!run) throw new Error('测试项目执行记录不存在');
  return run;
}

function readStatus(value: unknown): (typeof TERMINAL_STATUSES)[number] {
  if (
    typeof value !== 'string' ||
    !TERMINAL_STATUSES.some((status: TestRunStatus) => status === value)
  ) {
    throw new Error('子测试用例返回了无效状态');
  }
  return value as (typeof TERMINAL_STATUSES)[number];
}

function readRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('测试项目参数必须是对象');
  }
  return value as Record<string, unknown>;
}

function readText(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label}不能为空`);
  return value.trim();
}

function optionalText(value: unknown): string | undefined {
  return value === undefined ? undefined : readText(value, '文本参数');
}

function sanitizeError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 2_000);
}
