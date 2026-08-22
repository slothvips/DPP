import { useLiveQuery } from 'dexie-react-hooks';
import { Edit3, ExternalLink, Play, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/toast';
import { deleteTestCase, listTestCases, listTestRuns } from '@/lib/db/testing';
import { runTestCase } from '../services/testExecutionService';
import type { TestCase, TestReport, TestRun } from '../types';

function statusLabel(status: TestRun['status']): string {
  return {
    queued: '排队中',
    running: '执行中',
    passed: '通过',
    failed: '失败',
    stopped: '已停止',
  }[status];
}

function reportText(report: TestReport): string {
  return report.steps.length > 0
    ? report.steps
        .map(
          (step) =>
            `${step.index}. ${step.status === 'passed' ? '通过' : '失败'} ${step.description}`
        )
        .join('\n')
    : report.error || report.summary;
}

function openTestCaseEditor(id?: string) {
  const query = id ? `?id=${encodeURIComponent(id)}` : '';
  const editorPath = `/test-case-editor.html${query}` as Parameters<
    typeof browser.runtime.getURL
  >[0];
  void browser.tabs.create({ url: browser.runtime.getURL(editorPath) });
}

function openAISession(sessionId: string) {
  sessionStorage.setItem('ai_current_session_id', sessionId);
  window.dispatchEvent(new CustomEvent('dpp:open-ai-session', { detail: { sessionId } }));
}

export function TestingView() {
  const testCases = useLiveQuery(() => listTestCases(), [], []);
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(testCases[0]?.id ?? null);
  const [recordingEnabled, setRecordingEnabled] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [runs, setRuns] = useState<TestRun[]>([]);
  const runsRequestRef = useRef(0);

  useEffect(() => {
    if (selectedId || testCases.length === 0) return;
    const firstCase = testCases[0];
    setSelectedId(firstCase.id);
    const requestId = runsRequestRef.current + 1;
    runsRequestRef.current = requestId;
    void listTestRuns(firstCase.id).then((nextRuns) => {
      if (runsRequestRef.current === requestId) setRuns(nextRuns);
    });
  }, [selectedId, testCases]);

  const selected = testCases.find((item) => item.id === selectedId) ?? null;

  function selectCase(testCase: TestCase) {
    setSelectedId(testCase.id);
    const requestId = runsRequestRef.current + 1;
    runsRequestRef.current = requestId;
    void listTestRuns(testCase.id).then((nextRuns) => {
      if (runsRequestRef.current === requestId) setRuns(nextRuns);
    });
  }

  function startNewCase() {
    setSelectedId(null);
    setRuns([]);
  }

  async function handleDelete() {
    if (!selected) return;
    try {
      await deleteTestCase(selected.id);
      startNewCase();
      toast('测试用例已删除', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : '删除测试用例失败', 'error');
    }
  }

  async function handleRun() {
    if (!selected) {
      toast('请先保存测试用例', 'error');
      return;
    }
    setIsRunning(true);
    try {
      const run = await runTestCase(selected, recordingEnabled);
      setRuns(await listTestRuns(selected.id));
      toast(
        run.status === 'passed' ? '测试通过' : '测试完成，但未通过',
        run.status === 'passed' ? 'success' : 'error'
      );
    } catch (error) {
      toast(error instanceof Error ? error.message : '启动测试失败', 'error');
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 gap-3 p-3">
      <section className="flex w-44 shrink-0 min-h-0 flex-col rounded-2xl border border-border/55 bg-background/70 p-2">
        <div className="flex items-center justify-between px-2 pb-2">
          <h1 className="text-sm font-semibold">测试用例</h1>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="新建用例"
            onClick={() => openTestCaseEditor()}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          {testCases.map((testCase) => (
            <button
              key={testCase.id}
              type="button"
              className={`w-full rounded-xl px-2.5 py-2 text-left text-xs ${selectedId === testCase.id ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-muted/60'}`}
              onClick={() => selectCase(testCase)}
            >
              <span className="block truncate font-medium">{testCase.name}</span>
              <span className="mt-1 block truncate text-[11px]">{testCase.instruction}</span>
            </button>
          ))}
          {testCases.length === 0 && (
            <p className="px-2 py-4 text-xs text-muted-foreground">暂无测试用例</p>
          )}
        </div>
      </section>

      <section className="min-w-0 flex-1 overflow-y-auto rounded-2xl border border-border/55 bg-background/70 p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">{selected ? selected.name : '选择测试用例'}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              测试内容在独立 Markdown 页面编辑，D 仔会从当前标签页开始执行。
            </p>
          </div>
          {selected && (
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="编辑用例"
                onClick={() => openTestCaseEditor(selected.id)}
              >
                <Edit3 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                title="删除用例"
                disabled={isRunning}
                onClick={() => void handleDelete()}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
        <div className="mt-4 space-y-3">
          {selected ? (
            <div className="rounded-xl border border-border/50 bg-muted/20 p-3 text-sm whitespace-pre-wrap text-muted-foreground">
              {selected.instruction}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
              点击左上角加号创建测试用例
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3 border-t border-border/50 pt-3">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox
                checked={recordingEnabled}
                onCheckedChange={(checked) => setRecordingEnabled(checked === true)}
              />
              执行时开启录像
            </label>
            <Button
              variant="outline"
              className="ml-auto"
              disabled={!selected || isRunning}
              onClick={() => void handleRun()}
            >
              <Play className="mr-1.5 h-3.5 w-3.5" />
              {isRunning ? '测试执行中...' : '开始测试'}
            </Button>
          </div>
        </div>

        {selected && (
          <div className="mt-6 border-t border-border/50 pt-4">
            <h3 className="text-sm font-semibold">执行记录</h3>
            <div className="mt-2 space-y-2">
              {runs.map((run) => (
                <div
                  key={run.id}
                  className="rounded-xl border border-border/50 bg-muted/20 p-3 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={
                        run.status === 'passed'
                          ? 'text-success'
                          : run.status === 'failed'
                            ? 'text-destructive'
                            : 'text-muted-foreground'
                      }
                    >
                      {statusLabel(run.status)}
                    </span>
                    <span className="text-muted-foreground">
                      {new Date(run.startedAt).toLocaleString()}
                    </span>
                  </div>
                  {run.report && (
                    <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
                      {reportText(run.report)}
                    </p>
                  )}
                  <div className="mt-2 flex gap-3">
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => openAISession(run.aiSessionId)}
                    >
                      <ExternalLink className="mr-1 inline h-3 w-3" />
                      查看 D 仔会话
                    </button>
                    {run.recordingId && <span className="text-muted-foreground">已关联录像</span>}
                  </div>
                </div>
              ))}
              {runs.length === 0 && <p className="text-xs text-muted-foreground">暂无执行记录</p>}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
