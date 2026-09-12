import {
  Box,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  GitCommit,
  GitFork,
  ListChecks,
  LoaderCircle,
  RefreshCw,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { VirtualList } from '@/components/ui/virtual-list';
import type { MyBuildItem } from '@/db';
import { JenkinsSectionHeader } from '@/features/jenkins/components/jenkinsUi';
import type {
  JenkinsBuildDetailsResult,
  JenkinsPipelineInput,
  JenkinsPipelineNode,
  JenkinsPipelineNodeLog,
  JenkinsPipelineResult,
  JenkinsTestDetailsResult,
} from '@/features/jenkins/messages';
import { JenkinsService } from '@/features/jenkins/service';
import { translateStatus } from '@/features/jenkins/utils';
import { logger } from '@/utils/logger';
import { redactSensitiveText } from '@/utils/sensitive';

interface JenkinsBuildDetailsDialogProps {
  build: MyBuildItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelineEnabled?: boolean;
  artifactsEnabled?: boolean;
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === undefined) return '';
  return JSON.stringify(value) ?? String(value);
}

export function JenkinsBuildDetailsDialog({
  build,
  open,
  onOpenChange,
  pipelineEnabled = true,
  artifactsEnabled = true,
}: JenkinsBuildDetailsDialogProps) {
  const [details, setDetails] = useState<JenkinsBuildDetailsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState(0);
  const [testDetails, setTestDetails] = useState<JenkinsTestDetailsResult | null>(null);
  const [testDetailsError, setTestDetailsError] = useState<string | null>(null);
  const [testDetailsLoading, setTestDetailsLoading] = useState(false);
  const [testDetailsOpen, setTestDetailsOpen] = useState(false);
  const [downloadingArtifact, setDownloadingArtifact] = useState<string | null>(null);
  const [pipeline, setPipeline] = useState<JenkinsPipelineResult | null>(null);
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [expandedStageId, setExpandedStageId] = useState<string | null>(null);
  const [stageNodes, setStageNodes] = useState<JenkinsPipelineNode[] | null>(null);
  const [stageNodesLoading, setStageNodesLoading] = useState(false);
  const [stageNodesError, setStageNodesError] = useState<string | null>(null);
  const [nodeLog, setNodeLog] = useState<JenkinsPipelineNodeLog | null>(null);
  const [nodeLogLoading, setNodeLogLoading] = useState<string | null>(null);
  const [redactNodeLog, setRedactNodeLog] = useState(false);
  const [nodeLogWrap, setNodeLogWrap] = useState(true);
  const [pendingInputAction, setPendingInputAction] = useState<{
    input: JenkinsPipelineInput;
    decision: 'proceed' | 'abort';
  } | null>(null);
  const [inputActionLoading, setInputActionLoading] = useState(false);
  const testDetailsId = useId();
  const nodeLogRedactId = useId();
  const nodeLogWrapId = useId();
  const stageRequestIdRef = useRef(0);
  const nodeLogRequestIdRef = useRef(0);
  const { toast } = useToast();
  const handleErrorRef = useRef<(cause: unknown) => void>(() => {});

  useEffect(() => {
    handleErrorRef.current = (cause: unknown) => {
      logger.error('Failed to fetch Jenkins build details', cause);
      setError(cause instanceof Error ? cause.message : '构建详情加载失败');
      toast('构建详情加载失败', 'error');
    };
  });

  useEffect(() => {
    if (!open) return;
    let active = true;
    setDetails(null);
    setError(null);
    setTestDetails(null);
    setTestDetailsError(null);
    setTestDetailsOpen(false);
    setDownloadingArtifact(null);
    setPipeline(null);
    setPipelineLoading(pipelineEnabled);
    setExpandedStageId(null);
    setStageNodes(null);
    setStageNodesError(null);
    setNodeLog(null);
    setRedactNodeLog(false);
    setNodeLogWrap(true);
    setPendingInputAction(null);
    setInputActionLoading(false);
    stageRequestIdRef.current++;
    nodeLogRequestIdRef.current++;

    void JenkinsService.getBuildDetails(build.id, build.env)
      .then((result) => {
        if (active) setDetails(result);
      })
      .catch((cause: unknown) => {
        if (active) handleErrorRef.current(cause);
      });
    if (pipelineEnabled) {
      void JenkinsService.getPipelineStages(build.id, build.env)
        .then((result) => {
          if (active) setPipeline(result);
        })
        .catch((cause: unknown) => {
          if (active) {
            setPipeline({
              capability: 'error',
              reason: cause instanceof Error ? cause.message : 'Pipeline 阶段读取失败',
              stages: [],
              pendingInputs: [],
            });
          }
        })
        .finally(() => {
          if (active) setPipelineLoading(false);
        });
    }

    return () => {
      active = false;
    };
  }, [build.env, build.id, open, pipelineEnabled, requestId]);

  const testStatus = details?.test_report_status;
  const report = details?.test_report;

  async function loadTestDetails() {
    setTestDetailsLoading(true);
    setTestDetailsError(null);
    try {
      setTestDetails(await JenkinsService.getTestDetails(build.id, build.env));
    } catch (cause) {
      logger.error('Failed to fetch Jenkins test details', cause);
      setTestDetailsError(cause instanceof Error ? cause.message : '测试详情加载失败');
      toast('测试详情加载失败', 'error');
    } finally {
      setTestDetailsLoading(false);
    }
  }

  function toggleTestDetails() {
    const nextOpen = !testDetailsOpen;
    setTestDetailsOpen(nextOpen);
    if (nextOpen && !testDetails && !testDetailsLoading) void loadTestDetails();
  }

  async function toggleStage(stageId: string) {
    if (expandedStageId === stageId) {
      stageRequestIdRef.current++;
      nodeLogRequestIdRef.current++;
      setExpandedStageId(null);
      setNodeLog(null);
      return;
    }

    setExpandedStageId(stageId);
    setStageNodes(null);
    setStageNodesError(null);
    setNodeLog(null);
    nodeLogRequestIdRef.current++;
    setStageNodesLoading(true);
    const requestId = ++stageRequestIdRef.current;
    try {
      const nodes = await JenkinsService.getPipelineStageNodes(build.id, stageId, build.env);
      if (requestId === stageRequestIdRef.current) setStageNodes(nodes);
    } catch (cause) {
      logger.error('Failed to fetch Jenkins Pipeline stage nodes', cause);
      if (requestId === stageRequestIdRef.current) {
        setStageNodesError(cause instanceof Error ? cause.message : 'Pipeline 阶段节点读取失败');
      }
    } finally {
      if (requestId === stageRequestIdRef.current) setStageNodesLoading(false);
    }
  }

  async function loadNodeLog(nodeId: string) {
    setNodeLogLoading(nodeId);
    setNodeLog(null);
    const requestId = ++nodeLogRequestIdRef.current;
    try {
      const result = await JenkinsService.getPipelineNodeLog(build.id, nodeId, build.env);
      if (requestId === nodeLogRequestIdRef.current) setNodeLog(result);
    } catch (cause) {
      logger.error('Failed to fetch Jenkins Pipeline node log', cause);
      if (requestId === nodeLogRequestIdRef.current) {
        toast(cause instanceof Error ? cause.message : 'Pipeline 节点日志读取失败', 'error');
      }
    } finally {
      if (requestId === nodeLogRequestIdRef.current) setNodeLogLoading(null);
    }
  }

  async function submitPendingInput() {
    if (!pendingInputAction) return;
    setInputActionLoading(true);
    try {
      await JenkinsService.submitPipelineInput(
        build.id,
        pendingInputAction.input.id,
        pendingInputAction.decision,
        build.env
      );
      toast(pendingInputAction.decision === 'proceed' ? '审批已通过' : '审批已拒绝', 'success');
      setPendingInputAction(null);
      setRequestId((value) => value + 1);
    } catch (cause) {
      logger.error('Failed to submit Jenkins Pipeline input', cause);
      toast(cause instanceof Error ? cause.message : 'Pipeline 审批操作失败', 'error');
    } finally {
      setInputActionLoading(false);
    }
  }

  const visibleNodeLog = useMemo(
    () => (redactNodeLog && nodeLog ? redactSensitiveText(nodeLog.text) : nodeLog?.text || ''),
    [nodeLog, redactNodeLog]
  );
  const nodeLogLines = useMemo(
    () => (visibleNodeLog ? visibleNodeLog.split(/\r?\n/) : []),
    [visibleNodeLog]
  );

  async function handleArtifactDownload(fileName: string, relativePath: string) {
    setDownloadingArtifact(relativePath);
    try {
      const result = await JenkinsService.downloadArtifact(build.id, relativePath, build.env);
      const binary = atob(result.base64);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index++) {
        bytes[index] = binary.charCodeAt(index);
      }
      const url = URL.createObjectURL(new Blob([bytes], { type: result.contentType }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName.replace(/[\\/:*?"<>|]/g, '-') || 'artifact';
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (cause) {
      logger.error('Failed to download Jenkins artifact', cause);
      toast(cause instanceof Error ? cause.message : '产物下载失败', 'error');
    } finally {
      setDownloadingArtifact(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-1rem)] w-[calc(100vw-1rem)] max-w-3xl flex-col gap-3 p-4">
        <DialogHeader className="min-w-0 pr-8">
          <DialogTitle className="truncate text-base" title={`${build.jobName} #${build.number}`}>
            {build.jobName} #{build.number}
          </DialogTitle>
          <DialogDescription>
            {details
              ? `${translateStatus(details.build.result)}${details.build.built_on ? ` · ${details.build.built_on}` : ''}`
              : 'Jenkins 构建详情'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-auto pr-1 text-sm">
          {!details && !error && (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              加载中...
            </div>
          )}
          {error && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRequestId((value) => value + 1)}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                重试
              </Button>
            </div>
          )}
          {details && (
            <div className="space-y-4">
              <section aria-labelledby="jenkins-pipeline-stages">
                <JenkinsSectionHeader
                  id="jenkins-pipeline-stages"
                  icon={<GitFork className="h-4 w-4 text-primary" />}
                  title="Pipeline 阶段"
                />
                {!pipelineEnabled ? (
                  <p className="text-xs text-muted-foreground">Pipeline 能力已关闭</p>
                ) : pipelineLoading ? (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                    探测 Pipeline 能力...
                  </p>
                ) : pipeline?.capability === 'available' ? (
                  <>
                    {pipeline.stages.length > 0 ? (
                      <ol className="space-y-1.5 text-xs">
                        {pipeline.stages.map((stage, index) => (
                          <li
                            key={stage.id || `${stage.name || 'stage'}-${index}`}
                            className="min-w-0"
                          >
                            <button
                              type="button"
                              className="grid w-full grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-2 border-0 bg-transparent py-0.5 text-left"
                              disabled={!stage.id}
                              aria-expanded={stage.id ? expandedStageId === stage.id : undefined}
                              onClick={() => stage.id && void toggleStage(stage.id)}
                            >
                              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-border font-mono text-[10px] text-muted-foreground">
                                {index + 1}
                              </span>
                              <span className="truncate" title={stage.name}>
                                {stage.name || '未命名阶段'}
                              </span>
                              <span className="text-muted-foreground">
                                {stage.status || 'UNKNOWN'}
                                {stage.durationMillis !== undefined
                                  ? ` · ${(stage.durationMillis / 1000).toFixed(1)}s`
                                  : ''}
                              </span>
                            </button>
                            {stage.id && expandedStageId === stage.id && (
                              <div className="ml-7 mt-1 space-y-1.5 border-l border-border pl-3">
                                {stageNodesLoading && (
                                  <p className="flex items-center gap-2 py-1 text-muted-foreground">
                                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                    加载节点...
                                  </p>
                                )}
                                {stageNodesError && (
                                  <p className="py-1 text-destructive">{stageNodesError}</p>
                                )}
                                {stageNodes?.map((node, nodeIndex) => (
                                  <div
                                    key={node.id || `${node.name || 'node'}-${nodeIndex}`}
                                    className="flex min-w-0 items-start gap-2"
                                  >
                                    <div className="min-w-0 flex-1 py-1">
                                      <p className="truncate" title={node.name}>
                                        {node.name || '未命名节点'}
                                      </p>
                                      <p className="text-muted-foreground">
                                        {[node.status, `${(node.durationMillis ?? 0) / 1000}s`]
                                          .filter(Boolean)
                                          .join(' · ')}
                                      </p>
                                      {node.error && (
                                        <p className="mt-1 break-words text-destructive">
                                          {node.error}
                                        </p>
                                      )}
                                    </div>
                                    {node.hasLog && node.id && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 shrink-0"
                                        disabled={nodeLogLoading !== null}
                                        title={`查看 ${node.name || '节点'} 日志`}
                                        onClick={() => void loadNodeLog(node.id as string)}
                                      >
                                        {nodeLogLoading === node.id ? (
                                          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                          <FileText className="h-3.5 w-3.5" />
                                        )}
                                      </Button>
                                    )}
                                  </div>
                                ))}
                                {stageNodes && stageNodes.length === 0 && (
                                  <p className="py-1 text-muted-foreground">此阶段没有可用节点</p>
                                )}
                                {nodeLog && (
                                  <div className="space-y-2 pt-1">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-muted-foreground">
                                        节点日志{nodeLog.truncated ? '（插件仅返回部分内容）' : ''}
                                      </span>
                                      <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-2">
                                          <Checkbox
                                            id={nodeLogWrapId}
                                            checked={nodeLogWrap}
                                            onCheckedChange={(checked) =>
                                              setNodeLogWrap(checked === true)
                                            }
                                          />
                                          <Label
                                            htmlFor={nodeLogWrapId}
                                            className="cursor-pointer text-xs font-normal"
                                          >
                                            自动换行
                                          </Label>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <Checkbox
                                            id={nodeLogRedactId}
                                            checked={redactNodeLog}
                                            onCheckedChange={(checked) =>
                                              setRedactNodeLog(checked === true)
                                            }
                                          />
                                          <Label
                                            htmlFor={nodeLogRedactId}
                                            className="cursor-pointer text-xs font-normal"
                                          >
                                            脱敏
                                          </Label>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="h-64 overflow-hidden rounded-md border border-border bg-muted/30 font-mono text-xs leading-5">
                                      {nodeLogLines.length > 0 ? (
                                        <VirtualList
                                          items={nodeLogLines}
                                          estimateSize={20}
                                          overscan={20}
                                          dynamicSize
                                          renderItem={(line) => (
                                            <div
                                              className={
                                                nodeLogWrap
                                                  ? 'whitespace-pre-wrap break-words px-2'
                                                  : 'min-w-max whitespace-pre px-2'
                                              }
                                            >
                                              {line || ' '}
                                            </div>
                                          )}
                                        />
                                      ) : (
                                        <div className="flex h-full items-center justify-center text-muted-foreground">
                                          暂无日志输出
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="text-xs text-muted-foreground">Pipeline 尚未生成阶段数据</p>
                    )}
                    {(pipeline.pendingInputs.length > 0 || pipeline.pendingInputError) && (
                      <div className="mt-3 border-t border-border pt-3 text-xs">
                        <h4 className="mb-2 font-medium">等待人工审批</h4>
                        {pipeline.pendingInputError && (
                          <p className="text-destructive">{pipeline.pendingInputError}</p>
                        )}
                        <ul className="space-y-2">
                          {pipeline.pendingInputs.map((input) => (
                            <li
                              key={input.id}
                              className="flex min-w-0 flex-col gap-2 border-b border-border pb-2 last:border-0 last:pb-0 sm:flex-row sm:items-center"
                            >
                              <p className="min-w-0 flex-1 break-words">{input.message}</p>
                              <div className="flex shrink-0 items-center gap-2">
                                {input.canProceed ? (
                                  <Button
                                    size="sm"
                                    className="h-7"
                                    disabled={inputActionLoading}
                                    onClick={() =>
                                      setPendingInputAction({ input, decision: 'proceed' })
                                    }
                                  >
                                    <Check className="mr-1.5 h-3.5 w-3.5" />
                                    批准
                                  </Button>
                                ) : (
                                  <span className="text-muted-foreground">
                                    需在 Jenkins 填写参数
                                  </span>
                                )}
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="h-7"
                                  disabled={inputActionLoading}
                                  onClick={() =>
                                    setPendingInputAction({ input, decision: 'abort' })
                                  }
                                >
                                  <X className="mr-1.5 h-3.5 w-3.5" />
                                  拒绝
                                </Button>
                              </div>
                            </li>
                          ))}
                        </ul>
                        {pendingInputAction && (
                          <div
                            className="mt-3 border-l-2 border-primary pl-3"
                            role="status"
                            aria-live="polite"
                          >
                            <h5 className="font-medium">
                              确认{pendingInputAction.decision === 'proceed' ? '批准' : '拒绝'}
                              此审批
                            </h5>
                            <dl className="mt-2 grid grid-cols-[4rem_minmax(0,1fr)] gap-x-2 gap-y-1 text-muted-foreground">
                              <dt>环境</dt>
                              <dd className="break-all font-mono">{build.env}</dd>
                              <dt>Job</dt>
                              <dd className="break-words">{build.jobName}</dd>
                              <dt>Build</dt>
                              <dd>#{build.number}</dd>
                              <dt>审批</dt>
                              <dd className="break-words">{pendingInputAction.input.message}</dd>
                            </dl>
                            <div className="mt-3 flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={inputActionLoading}
                                onClick={() => setPendingInputAction(null)}
                              >
                                取消
                              </Button>
                              <Button
                                variant={
                                  pendingInputAction.decision === 'abort'
                                    ? 'destructive'
                                    : 'default'
                                }
                                size="sm"
                                disabled={inputActionLoading}
                                onClick={() => void submitPendingInput()}
                              >
                                {inputActionLoading && (
                                  <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                )}
                                确认{pendingInputAction.decision === 'proceed' ? '批准' : '拒绝'}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {pipeline?.reason || 'Pipeline 能力不可用'}
                  </p>
                )}
              </section>

              <section
                className="border-t border-border pt-4"
                aria-labelledby="jenkins-test-summary"
              >
                <JenkinsSectionHeader
                  id="jenkins-test-summary"
                  icon={<ListChecks className="h-4 w-4 text-primary" />}
                  title="测试汇总"
                />
                {testStatus === 'available' && report ? (
                  <>
                    <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                      <span>通过 {report.passCount ?? 0}</span>
                      <span className="text-destructive">失败 {report.failCount ?? 0}</span>
                      <span>跳过 {report.skipCount ?? 0}</span>
                      <span>总计 {report.totalCount ?? 0}</span>
                    </div>
                    {(report.failCount ?? 0) > 0 && (
                      <div className="mt-3">
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 border-0 bg-transparent py-1 text-left text-xs font-medium text-primary"
                          aria-expanded={testDetailsOpen}
                          aria-controls={testDetailsId}
                          onClick={toggleTestDetails}
                        >
                          {testDetailsOpen ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          失败用例
                        </button>
                        {testDetailsOpen && (
                          <div id={testDetailsId} className="mt-2 space-y-2">
                            {testDetailsLoading && (
                              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                加载失败用例...
                              </p>
                            )}
                            {testDetailsError && (
                              <div className="flex items-center gap-2">
                                <p className="min-w-0 flex-1 text-xs text-destructive">
                                  {testDetailsError}
                                </p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    void loadTestDetails();
                                  }}
                                >
                                  <RefreshCw className="mr-2 h-3.5 w-3.5" />
                                  重试
                                </Button>
                              </div>
                            )}
                            {testDetails?.cases.map((testCase, index) => (
                              <article
                                key={`${testCase.className || testCase.suite || 'test'}-${testCase.name || index}`}
                                className="rounded-md border border-border p-2 text-xs"
                              >
                                <h4 className="break-words font-medium">
                                  {[testCase.className, testCase.name]
                                    .filter(Boolean)
                                    .join(' · ') || '未命名用例'}
                                </h4>
                                <p className="mt-1 text-muted-foreground">
                                  {[testCase.suite, testCase.status, `${testCase.duration ?? 0}s`]
                                    .filter(Boolean)
                                    .join(' · ')}
                                </p>
                                {testCase.errorDetails && (
                                  <p className="mt-2 whitespace-pre-wrap break-words text-destructive">
                                    {testCase.errorDetails}
                                  </p>
                                )}
                                {testCase.errorStackTrace && (
                                  <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-sm bg-muted p-2 font-mono text-muted-foreground">
                                    {testCase.errorStackTrace}
                                  </pre>
                                )}
                              </article>
                            ))}
                            {testDetails && testDetails.cases.length === 0 && (
                              <p className="text-xs text-muted-foreground">
                                报告未返回失败用例详情
                              </p>
                            )}
                            {testDetails?.truncated && (
                              <p className="text-xs text-muted-foreground">
                                仅显示前 {testDetails.cases.length} 个失败用例，共{' '}
                                {testDetails.totalFailures} 个
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {testStatus === 'pending'
                      ? '构建尚未完成，测试报告暂不可用'
                      : testStatus === 'permission'
                        ? '当前账号无权读取测试报告'
                        : testStatus === 'error'
                          ? details.test_report_error || '测试报告读取失败'
                          : '此构建没有测试报告'}
                  </p>
                )}
              </section>

              <section className="border-t border-border pt-4" aria-labelledby="jenkins-parameters">
                <JenkinsSectionHeader
                  id="jenkins-parameters"
                  icon={<SlidersHorizontal className="h-4 w-4 text-primary" />}
                  title="构建参数"
                />
                {details.build.parameters.length === 0 ? (
                  <p className="text-xs text-muted-foreground">无参数</p>
                ) : (
                  <dl className="grid grid-cols-[minmax(6rem,auto)_1fr] gap-x-3 gap-y-1 text-xs">
                    {details.build.parameters.map((parameter, index) => (
                      <div key={`${parameter.name || 'parameter'}-${index}`} className="contents">
                        <dt className="truncate font-medium" title={parameter.name}>
                          {parameter.name || '未命名参数'}
                        </dt>
                        <dd className="min-w-0 break-all font-mono text-muted-foreground">
                          {formatValue(parameter.value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </section>

              <section className="border-t border-border pt-4" aria-labelledby="jenkins-changes">
                <JenkinsSectionHeader
                  id="jenkins-changes"
                  icon={<GitCommit className="h-4 w-4 text-primary" />}
                  title="变更"
                />
                {details.build.changes.length === 0 ? (
                  <p className="text-xs text-muted-foreground">无变更记录</p>
                ) : (
                  <ul className="space-y-2 text-xs">
                    {details.build.changes.map((change, index) => (
                      <li key={`${change.commit_id || 'change'}-${index}`}>
                        <p className="break-words">{change.message || '无提交说明'}</p>
                        <p className="mt-0.5 text-muted-foreground">
                          {[change.author, change.commit_id?.slice(0, 10)]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="border-t border-border pt-4" aria-labelledby="jenkins-artifacts">
                <JenkinsSectionHeader
                  id="jenkins-artifacts"
                  icon={<Box className="h-4 w-4 text-primary" />}
                  title="产物"
                />
                {details.build.artifacts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">无产物</p>
                ) : (
                  <ul className="space-y-2 text-xs">
                    {details.build.artifacts.map((artifact, index) => (
                      <li
                        key={`${artifact.relativePath || artifact.fileName || 'artifact'}-${index}`}
                        className="flex min-w-0 items-start justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium" title={artifact.fileName}>
                            {artifact.fileName || '未命名产物'}
                          </p>
                          <p className="break-all font-mono text-muted-foreground">
                            {artifact.relativePath}
                          </p>
                        </div>
                        {artifact.relativePath ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            disabled={!artifactsEnabled || downloadingArtifact !== null}
                            title={`下载 ${artifact.fileName || '产物'}`}
                            onClick={() =>
                              void handleArtifactDownload(
                                artifact.fileName || 'artifact',
                                artifact.relativePath as string
                              )
                            }
                          >
                            {downloadingArtifact === artifact.relativePath ? (
                              <LoaderCircle className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                          </Button>
                        ) : (
                          <span className="shrink-0 text-muted-foreground">不可用</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
