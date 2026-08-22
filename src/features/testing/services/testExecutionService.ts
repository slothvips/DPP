import { browser } from 'wxt/browser';
import { executeBrowserTask } from '@/lib/ai/tools/browserTask';
import { resolveRecorderTabId, sendRecorderMessage } from '@/lib/ai/tools/recorderShared';
import { addMessage, createSession } from '@/lib/db/ai';
import { createTestRun, updateTestRun } from '@/lib/db/testing';
import { logger } from '@/utils/logger';
import type { TestCase, TestReport, TestReportStep, TestRun } from '../types';

interface RecordingSavedMessage {
  type: 'RECORDER_SAVED';
  recordingId: string;
}

function buildTask(testCase: TestCase): string {
  return `你正在执行自动化测试用例“${testCase.name}”。

测试要求：
${testCase.instruction}

请从当前活动标签页开始，逐步执行并验证每个测试要求。每一步都必须先观察页面，再进行操作或判断，不要跳过预期结果验证。

任务结束时，必须在最终结果中输出一个 JSON 对象，不要使用 Markdown 代码围栏，格式如下：
{"passed":true,"summary":"测试结果摘要","steps":[{"index":1,"description":"执行的步骤","expected":"预期结果","actual":"实际结果","status":"passed","detail":"补充说明"}]}
其中 status 只能是 passed、failed 或 blocked。所有步骤完成且预期均满足时 passed 才能为 true。`;
}

function parseReport(message: string): TestReport {
  const jsonCandidate = message.match(/\{[\s\S]*\}/)?.[0] ?? message;
  try {
    const parsed = JSON.parse(jsonCandidate) as {
      passed?: unknown;
      summary?: unknown;
      steps?: unknown;
    };
    if (typeof parsed.passed === 'boolean' && typeof parsed.summary === 'string') {
      const rawSteps = Array.isArray(parsed.steps) ? parsed.steps : [];
      const steps = rawSteps.flatMap((step, index) => {
        if (!step || typeof step !== 'object') return [];
        const item = step as Record<string, unknown>;
        const status = item.status;
        if (status !== 'passed' && status !== 'failed' && status !== 'blocked') return [];
        const stepStatus: TestReportStep['status'] = status;
        return [
          {
            index: typeof item.index === 'number' ? item.index : index + 1,
            description: typeof item.description === 'string' ? item.description : '',
            expected: typeof item.expected === 'string' ? item.expected : undefined,
            actual: typeof item.actual === 'string' ? item.actual : undefined,
            status: stepStatus,
            detail: typeof item.detail === 'string' ? item.detail : undefined,
          },
        ];
      });
      const hasInvalidSteps =
        steps.length === 0 ||
        steps.length !== rawSteps.length ||
        steps.some((step) => !step.description.trim());
      const hasFailedStep = steps.some(
        (step) => step.status === 'failed' || step.status === 'blocked'
      );
      return {
        passed: parsed.passed && !hasInvalidSteps && !hasFailedStep,
        summary: parsed.summary,
        steps,
        rawResult: message,
        ...(hasInvalidSteps ? { error: '测试报告缺少完整步骤' } : {}),
      };
    }
  } catch {
    // The raw result is retained below when the agent does not follow the JSON contract.
  }

  return {
    passed: false,
    summary: 'D 仔未返回可解析的结构化测试报告',
    steps: [],
    rawResult: message,
    error: 'Invalid test report format',
  };
}

async function addTestMessage(
  sessionId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<void> {
  try {
    await addMessage({ sessionId, role, content });
  } catch (error) {
    logger.error('[Testing] 保存 D 仔会话消息失败:', error);
  }
}

async function startRecording(tabId: number): Promise<void> {
  await sendRecorderMessage({ type: 'RECORDER_START', tabId });
}

async function stopRecording(tabId: number): Promise<string | undefined> {
  return new Promise<string | undefined>((resolve) => {
    let settled = false;
    const finish = (recordingId?: string) => {
      if (settled) return;
      settled = true;
      browser.runtime.onMessage.removeListener(listener);
      resolve(recordingId);
    };
    const timeoutId = setTimeout(() => finish(), 15_000);
    const listener = (message: unknown): false | undefined => {
      if (!message || typeof message !== 'object') return;
      const saved = message as Partial<RecordingSavedMessage>;
      if (saved.type === 'RECORDER_SAVED' && typeof saved.recordingId === 'string') {
        clearTimeout(timeoutId);
        finish(saved.recordingId);
      }
      return false;
    };

    browser.runtime.onMessage.addListener(listener);
    void sendRecorderMessage({ type: 'RECORDER_STOP', tabId }).catch(() => finish());
  });
}

export async function runTestCase(testCase: TestCase, recordingEnabled: boolean): Promise<TestRun> {
  const session = await createSession(`测试：${testCase.name}`);
  const run = await createTestRun({
    testCaseId: testCase.id,
    aiSessionId: session.id,
    recordingEnabled,
  });
  const userMessage = buildTask(testCase);

  await addTestMessage(session.id, 'user', userMessage);
  await updateTestRun(run.id, { status: 'running' });

  let tabId: number | undefined;
  try {
    if (recordingEnabled) {
      tabId = await resolveRecorderTabId();
      await startRecording(tabId);
    }

    const result = await executeBrowserTask({
      task: userMessage,
      group_name: `测试 ${testCase.name}`,
      session_id: session.id,
      onUpdate: (event) => {
        if (!event.status || event.status === 'running') {
          return;
        }
        void addTestMessage(session.id, 'assistant', `测试状态：${event.status}`);
      },
    });
    const report = parseReport(result.message);
    await addTestMessage(
      session.id,
      'assistant',
      `${report.summary}\n\n${JSON.stringify(report, null, 2)}`
    );

    const recordingId = tabId ? await stopRecording(tabId) : undefined;
    const finishedAt = Date.now();
    await updateTestRun(run.id, {
      status: result.success && report.passed ? 'passed' : 'failed',
      finishedAt,
      report,
      recordingId,
    });
    return {
      ...run,
      status: result.success && report.passed ? 'passed' : 'failed',
      finishedAt,
      report,
      recordingId,
    };
  } catch (error) {
    if (tabId) await stopRecording(tabId);
    const report: TestReport = {
      passed: false,
      summary: '测试执行失败',
      steps: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    await addTestMessage(session.id, 'assistant', `${report.summary}: ${report.error}`);
    const finishedAt = Date.now();
    await updateTestRun(run.id, { status: 'failed', finishedAt, report });
    return { ...run, status: 'failed', finishedAt, report };
  }
}
