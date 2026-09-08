import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Ban,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  FolderKanban,
  ListChecks,
  LoaderCircle,
  Pencil,
  Play,
  Plus,
  Save,
  Square,
  Timer,
  Trash2,
  XCircle,
} from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import type {
  DecryptedTestCaseMaterial,
  DecryptedTestProject,
  TestProjectCaseReference,
  TestRunStatus,
} from '@/features/aiAssistant/materials/testCaseTypes';
import {
  deleteTestProject,
  getTestRun,
  listTestProjectRuns,
  listTestProjects,
  updateTestProject,
} from '@/lib/db';
import { useConfirmDialog } from '@/utils/confirm-dialog';
import { logger } from '@/utils/logger';
import type { PromptMaterialFeedItem } from './PromptMaterialLibraryView';

interface TestProjectLibraryViewProps {
  search: string;
  testCases: DecryptedTestCaseMaterial[];
  onExecute: (project: { id: string; title: string }) => Promise<void>;
  onEditTestCase: (testCaseId: string) => void;
  onCreateTestCase: (projectId: string) => void;
  renderFeed?: (items: PromptMaterialFeedItem[]) => ReactNode;
}

export function TestProjectLibraryView({
  search,
  testCases,
  onExecute,
  onEditTestCase,
  onCreateTestCase,
  renderFeed,
}: TestProjectLibraryViewProps) {
  const projects = useLiveQuery(() => listTestProjects(), []) ?? [];
  const [selectedId, setSelectedId] = useState<string>();
  const { confirm } = useConfirmDialog();
  const { toast } = useToast();
  const selected = projects.find((project) => project.id === selectedId);
  const keyword = search.trim().toLocaleLowerCase();
  const testCaseById = new Map(testCases.map((testCase) => [testCase.id, testCase]));
  const projectItems = projects.flatMap((project) => {
    const projectTestCases = [...project.content.testCases]
      .sort((left, right) => left.order - right.order)
      .flatMap((reference) => {
        const testCase = testCaseById.get(reference.testCaseMaterialId);
        return testCase ? [testCase] : [];
      });
    const projectMatches =
      !keyword ||
      project.title.toLocaleLowerCase().includes(keyword) ||
      project.content.description?.toLocaleLowerCase().includes(keyword);
    const matchingTestCases = projectMatches
      ? projectTestCases
      : projectTestCases.filter((testCase) => testCaseMatches(testCase, keyword));
    return projectMatches || matchingTestCases.length > 0 ? [{ project }] : [];
  });

  async function handleDelete(project: DecryptedTestProject) {
    const confirmed = await confirm(
      `确定要删除“${project.title}”吗？\n测试用例和历史执行记录都会保留。`,
      '确认删除测试项目',
      'danger'
    );
    if (!confirmed) return;
    try {
      await deleteTestProject(project.id);
      setSelectedId(undefined);
      toast('测试项目已删除', 'success');
    } catch (error) {
      logger.error('[TestProject] Failed to delete project:', error);
      toast(error instanceof Error ? error.message : '删除测试项目失败', 'error');
    }
  }

  if (selected) {
    return (
      <ProjectDetail
        key={`${selected.id}:${selected.version}`}
        project={selected}
        testCases={testCases}
        onBack={() => setSelectedId(undefined)}
        onExecute={() => void onExecute(selected)}
        onDelete={() => void handleDelete(selected)}
        onEditTestCase={onEditTestCase}
        onCreateTestCase={onCreateTestCase}
      />
    );
  }

  const feedItems: PromptMaterialFeedItem[] = projectItems.map(({ project }) => ({
    id: `test-project:${project.id}`,
    updatedAt: project.updatedAt,
    content: (
      <ProjectCard
        project={project}
        onOpen={() => setSelectedId(project.id)}
        onExecute={() => void onExecute(project)}
      />
    ),
  }));

  if (renderFeed) return renderFeed(feedItems);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      {projectItems.length === 0 ? (
        <div className="flex min-h-56 flex-col items-center justify-center text-center">
          <FolderKanban className="h-8 w-8 text-muted-foreground" />
          <h3 className="mt-3 text-sm font-semibold">还没有测试用例</h3>
          <p className="mt-1 text-xs text-muted-foreground">导入测试用例时会自动归入项目。</p>
        </div>
      ) : (
        <div className="space-y-5">
          {feedItems.map((item) => (
            <div key={item.id}>{item.content}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({
  project,
  onOpen,
  onExecute,
}: {
  project: DecryptedTestProject;
  onOpen: () => void;
  onExecute: () => void;
}) {
  const runs = useLiveQuery(() => listTestProjectRuns(project.id), [project.id]);
  const latest = runs?.[0];
  return (
    <section>
      <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
        <div className="flex items-start gap-2">
          <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    测试用例集合
                  </span>
                  <h3 className="truncate text-sm font-medium">{project.title}</h3>
                </div>
                {project.content.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {project.content.description}
                  </p>
                )}
              </div>
              <span className="shrink-0 text-[11px] text-muted-foreground">v{project.version}</span>
            </div>
          </button>
        </div>
        <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>{project.content.testCases.length} 条用例</span>
          <span>{project.content.testCases.filter((item) => item.enabled).length} 条启用</span>
          <span className="ml-auto">
            {latest ? <ProjectStatus status={latest.status} /> : '未执行'}
          </span>
        </div>
        <Button size="sm" onClick={onExecute} className="mt-3 h-8 gap-1.5 text-xs">
          <Play className="h-3.5 w-3.5" />
          执行项目
        </Button>
      </div>
    </section>
  );
}

function testCaseMatches(testCase: DecryptedTestCaseMaterial, keyword: string): boolean {
  if (!keyword) return true;
  return (
    testCase.title.toLocaleLowerCase().includes(keyword) ||
    JSON.stringify(testCase.content).toLocaleLowerCase().includes(keyword)
  );
}

function ProjectDetail({
  project,
  testCases,
  onBack,
  onExecute,
  onDelete,
  onEditTestCase,
  onCreateTestCase,
}: {
  project: DecryptedTestProject;
  testCases: DecryptedTestCaseMaterial[];
  onBack: () => void;
  onExecute: () => void;
  onDelete: () => void;
  onEditTestCase: (testCaseId: string) => void;
  onCreateTestCase: (projectId: string) => void;
}) {
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.content.description ?? '');
  const [references, setReferences] = useState(project.content.testCases);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'config' | 'results'>('config');
  const { toast } = useToast();
  const runs = useLiveQuery(() => listTestProjectRuns(project.id), [project.id]);
  const caseById = new Map(testCases.map((testCase) => [testCase.id, testCase]));
  function replaceReferences(next: TestProjectCaseReference[]) {
    setReferences(next.map((item, index) => ({ ...item, order: index + 1 })));
  }

  function move(index: number, offset: number) {
    const target = index + offset;
    if (target < 0 || target >= references.length) return;
    const next = [...references];
    [next[index], next[target]] = [next[target], next[index]];
    replaceReferences(next);
  }

  async function save() {
    setSaving(true);
    try {
      await updateTestProject(
        project.id,
        { title, description, testCases: references },
        project.version
      );
      toast('测试项目已保存', 'success');
    } catch (error) {
      logger.error('[TestProject] Failed to save project:', error);
      toast(error instanceof Error ? error.message : '保存测试项目失败', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="h-8 gap-1.5 text-xs">
          <ArrowLeft className="h-3.5 w-3.5" />
          返回项目
        </Button>
        <span className="text-[11px] text-muted-foreground">v{project.version}</span>
      </div>

      <div className="mt-4">
        <h2 className="truncate text-base font-semibold">{project.title}</h2>
        <div
          className="mt-3 flex border-b border-border/60"
          role="tablist"
          aria-label="项目详情视图"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'config'}
            onClick={() => setActiveTab('config')}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium ${activeTab === 'config' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            <ListChecks className="h-3.5 w-3.5" />
            用例配置
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'results'}
            onClick={() => setActiveTab('results')}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium ${activeTab === 'results' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            执行结果
            {runs && runs.length > 0 && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{runs.length}</span>
            )}
          </button>
        </div>
      </div>

      {activeTab === 'config' ? (
        <>
          <div className="mt-4 space-y-3">
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              aria-label="项目名称"
            />
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="项目描述"
              aria-label="项目描述"
            />
          </div>

          <section className="mt-5">
            <h3 className="text-xs font-semibold">测试用例</h3>
            <div className="mt-2 space-y-2">
              {references.map((reference, index) => {
                const testCase = caseById.get(reference.testCaseMaterialId);
                return (
                  <div
                    key={reference.testCaseMaterialId}
                    className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2"
                  >
                    <span className="w-5 shrink-0 text-xs text-muted-foreground">{index + 1}.</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">
                        {testCase?.title ?? '测试用例已删除'}
                      </p>
                      {!testCase && (
                        <p className="text-[11px] text-destructive">失效引用，请移除</p>
                      )}
                    </div>
                    <label className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={reference.enabled}
                        onChange={(event) =>
                          replaceReferences(
                            references.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, enabled: event.target.checked }
                                : item
                            )
                          )
                        }
                      />
                      启用
                    </label>
                    {testCase && (
                      <ProjectIconButton
                        label="编辑测试用例"
                        onClick={() => onEditTestCase(testCase.id)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </ProjectIconButton>
                    )}
                    <ProjectIconButton
                      label="上移"
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </ProjectIconButton>
                    <ProjectIconButton
                      label="下移"
                      disabled={index === references.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </ProjectIconButton>
                    <ProjectIconButton
                      label="移除"
                      onClick={() =>
                        replaceReferences(references.filter((_, itemIndex) => itemIndex !== index))
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </ProjectIconButton>
                  </div>
                );
              })}
            </div>
            <div className="mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onCreateTestCase(project.id)}
                className="h-8 gap-1.5 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                添加测试用例
              </Button>
            </div>
          </section>

          <div className="mt-5 flex flex-wrap gap-2 border-t border-border/60 pt-3">
            <Button size="sm" onClick={onExecute} className="h-8 gap-1.5 text-xs">
              <Play className="h-3.5 w-3.5" />
              执行项目
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() => void save()}
              className="h-8 gap-1.5 text-xs"
            >
              {saving ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              保存
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onDelete}
              className="h-8 gap-1.5 text-xs text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              删除项目
            </Button>
          </div>
        </>
      ) : (
        <ProjectRunResults runs={runs} />
      )}
    </div>
  );
}

function ProjectRunResults({
  runs,
}: {
  runs: Awaited<ReturnType<typeof listTestProjectRuns>> | undefined;
}) {
  if (runs === undefined) {
    return <LoaderCircle className="mt-5 h-4 w-4 animate-spin text-muted-foreground" />;
  }

  if (runs.length === 0) {
    return (
      <div className="mt-5 rounded-lg border border-dashed border-border/70 px-4 py-8 text-center">
        <CheckCircle2 className="mx-auto h-6 w-6 text-muted-foreground" />
        <p className="mt-2 text-xs text-muted-foreground">还没有执行记录。</p>
      </div>
    );
  }

  return (
    <section className="mt-5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold">执行结果</h3>
          <p className="mt-1 text-[11px] text-muted-foreground">按执行批次查看测试用例结果</p>
        </div>
        <span className="text-[11px] text-muted-foreground">共 {runs.length} 次</span>
      </div>
      <div className="mt-3 divide-y divide-border/50 rounded-lg border border-border/60 px-3">
        {runs.map((run) => (
          <ProjectRunReport key={run.id} run={run} />
        ))}
      </div>
    </section>
  );
}

function ProjectRunReport({
  run,
}: {
  run: Awaited<ReturnType<typeof listTestProjectRuns>>[number];
}) {
  const [open, setOpen] = useState(false);
  const counts = run.content.testCases.reduce(
    (result, item) => {
      result[item.status] += 1;
      return result;
    },
    {
      queued: 0,
      running: 0,
      passed: 0,
      failed: 0,
      blocked: 0,
      error: 0,
      stopped: 0,
      skipped: 0,
    } as Record<TestRunStatus | 'skipped', number>
  );

  return (
    <div className="border-b border-border/50 py-2 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full flex-wrap items-center gap-x-2 gap-y-1 text-left text-xs"
      >
        <ProjectStatus status={run.status} />
        <span className="min-w-0 flex-1 truncate">{formatDate(run.startedAt)}</span>
        <span className="flex flex-wrap gap-x-1 text-[11px] text-muted-foreground">
          <span>{counts.passed} 通过</span>
          <span>/ {counts.failed} 失败</span>
          <span>/ {counts.blocked} 阻塞</span>
          {counts.error > 0 && <span>/ {counts.error} 技术错误</span>}
        </span>
        <span className="text-[11px] text-muted-foreground">v{run.projectVersion}</span>
        <ChevronDown
          className={`ml-auto h-3.5 w-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="mt-2 space-y-2 border-t border-border/40 pt-2 pb-1">
          {run.content.testCases.map((item) => (
            <ChildRunSummary key={`${item.order}:${item.testCaseMaterialId}`} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function ChildRunSummary({
  item,
}: {
  item: Awaited<ReturnType<typeof listTestProjectRuns>>[number]['content']['testCases'][number];
}) {
  const [open, setOpen] = useState(false);
  const childRun = useLiveQuery(
    () => (item.testRunId ? getTestRun(item.testRunId) : Promise.resolve(undefined)),
    [item.testRunId]
  );
  return (
    <div className="rounded-lg bg-muted/30 px-3 py-2 text-xs">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 text-left"
      >
        <span className="min-w-0 flex-1 truncate">
          {item.order}. {item.title}
        </span>
        <ProjectStatus status={item.status} />
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {(childRun?.content.report.summary || item.error) && (
        <p className="mt-1 whitespace-pre-wrap text-[11px] leading-5 text-muted-foreground">
          {childRun?.content.report.summary || item.error}
        </p>
      )}
      {open && childRun && (
        <div className="mt-2 space-y-2 border-t border-border/40 pt-2 text-[11px]">
          {childRun.content.report.error && (
            <p className="whitespace-pre-wrap leading-5 text-destructive/85">
              {childRun.content.report.error}
            </p>
          )}
          <div className="space-y-1.5">
            {childRun.content.testCaseSnapshot.steps.map((step) => {
              const result = childRun.content.report.stepResults.find(
                (stepResult) => stepResult.stepId === step.id
              );
              return (
                <div key={step.id} className="rounded-md bg-background/70 px-2.5 py-2">
                  <div className="flex items-start gap-2">
                    <span className="shrink-0 text-muted-foreground">{step.order}.</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">{step.action}</p>
                      <p className="mt-1 leading-5 text-muted-foreground">
                        预期：{step.expectedResult || '未填写'}
                      </p>
                      <p className="mt-1 leading-5 text-muted-foreground">
                        实际：{result?.actualResult || '尚未完成'}
                      </p>
                      {result?.detail && (
                        <p className="mt-1 whitespace-pre-wrap leading-5 text-muted-foreground">
                          说明：{result.detail}
                        </p>
                      )}
                      {result?.attempts && result.attempts.length > 1 && (
                        <details className="mt-1.5 text-muted-foreground">
                          <summary className="cursor-pointer">
                            尝试记录（{result.attempts.length} 次）
                          </summary>
                          <div className="mt-1 space-y-1 border-l border-border pl-2">
                            {result.attempts.map((attempt) => (
                              <p key={`${attempt.attempt}-${attempt.startedAt}`}>
                                第 {attempt.attempt} 次 · {attempt.status}
                                {attempt.detail ? `：${attempt.detail}` : ''}
                              </p>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                    {result ? (
                      <ProjectStatus status={result.status} />
                    ) : (
                      <span className="shrink-0 text-muted-foreground">待执行</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectStatus({ status }: { status: TestRunStatus | 'skipped' }) {
  const config = {
    queued: ['排队中', Timer, 'text-muted-foreground'],
    running: ['执行中', Timer, 'text-info'],
    passed: ['通过', CheckCircle2, 'text-success'],
    failed: ['失败', XCircle, 'text-destructive'],
    blocked: ['阻塞', Ban, 'text-warning'],
    error: ['技术错误', CircleAlert, 'text-destructive'],
    stopped: ['已停止', Square, 'text-muted-foreground'],
    skipped: ['已跳过', Square, 'text-muted-foreground'],
  }[status] as [string, typeof Timer, string];
  const Icon = config[1];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 text-[11px] ${config[2]}`}>
      <Icon className="h-3.5 w-3.5" />
      {config[0]}
    </span>
  );
}

function ProjectIconButton({
  label,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      {...props}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp);
}
