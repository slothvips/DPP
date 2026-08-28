import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  ClipboardCheck,
  Library,
  LoaderCircle,
  Pencil,
  Play,
  Plus,
  Search,
  Square,
  Timer,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import type {
  DecryptedTestCaseMaterial,
  DecryptedTestRun,
  MaterialType,
  TestCaseMaterialInput,
  TestCaseStep,
  TestCaseTarget,
  TestCaseTestData,
  TestRun,
  TestRunStatus,
  TestStepResult,
} from '@/features/aiAssistant/materials/testCaseTypes';
import {
  getTestCaseMaterial,
  listTestCaseMaterialRecords,
  listTestRunRecords,
  listTestRuns,
  updateTestCaseMaterial,
} from '@/lib/db';
import { logger } from '@/utils/logger';

const EMPTY_STATE_COPY = {
  title: '还没有测试用例',
  description: '点击“导入测试用例”，让 D 仔从自然语言整理并保存。',
};

type MaterialFilter = 'all' | MaterialType;

const MATERIAL_FILTERS: Array<{ value: MaterialFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'prompt', label: '提示词' },
  { value: 'workflow', label: '工作流' },
  { value: 'testCase', label: '测试用例' },
];

interface AIMaterialLibraryViewProps {
  onImportTestCase: () => Promise<void>;
  onExecuteTestCase: (material: { id: string; title: string }) => Promise<void>;
}

export function AIMaterialLibraryView({
  onImportTestCase,
  onExecuteTestCase,
}: AIMaterialLibraryViewProps) {
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<MaterialFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [decryptedMaterials, setDecryptedMaterials] = useState<DecryptedTestCaseMaterial[]>([]);
  const [decryptError, setDecryptError] = useState<string | null>(null);
  const materialRecordsQuery = useLiveQuery(() => listTestCaseMaterialRecords(), []);
  const materialRecords = useMemo(() => materialRecordsQuery ?? [], [materialRecordsQuery]);
  const latestRunsQuery = useLiveQuery(
    () =>
      Promise.all(
        materialRecords.map(
          async (material) => [material.id, await listTestRunRecords(material.id)] as const
        )
      ),
    [materialRecords]
  );
  const latestRuns = useMemo(() => {
    const runs = new Map<string, TestRun>();
    for (const [materialId, records] of latestRunsQuery ?? []) {
      const latest = records.at(-1);
      if (latest) runs.set(materialId, latest);
    }
    return runs;
  }, [latestRunsQuery]);
  const emptyState = EMPTY_STATE_COPY;

  useEffect(() => {
    let cancelled = false;
    setDecryptError(null);

    const loadContent = async () => {
      try {
        const results = await Promise.all(
          materialRecords.map(async (material) => {
            try {
              const decrypted = await getTestCaseMaterial(material.id);
              return decrypted ? { material: decrypted } : { material: null };
            } catch (error) {
              logger.warn(`[MaterialLibrary] Failed to decrypt ${material.id}:`, error);
              return { material: null };
            }
          })
        );
        const materials = results.flatMap((result) => (result.material ? [result.material] : []));
        if (!cancelled) {
          setDecryptedMaterials(materials);
          setDecryptError(
            materials.length < materialRecords.length
              ? '部分测试用例无法读取，请检查团队加密密钥'
              : null
          );
        }
      } catch (error) {
        logger.error('[MaterialLibrary] Failed to decrypt test cases:', error);
        if (!cancelled) {
          setDecryptedMaterials([]);
          setDecryptError('无法读取测试用例内容，请检查团队加密密钥');
        }
      }
    };

    void loadContent();
    return () => {
      cancelled = true;
    };
  }, [materialRecords]);

  const handleTypeChange = (type: MaterialFilter) => {
    setSelectedType(type);
    setSelectedId(null);
  };

  const filteredMaterials = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return decryptedMaterials.filter((material) => {
      if (selectedType !== 'all' && material.type !== selectedType) return false;
      if (!keyword) return true;
      const searchable = JSON.stringify(material.content).toLowerCase();
      return material.title.toLowerCase().includes(keyword) || searchable.includes(keyword);
    });
  }, [decryptedMaterials, search, selectedType]);

  const selectedMaterial = selectedId
    ? decryptedMaterials.find((material) => material.id === selectedId)
    : undefined;
  const canImportTestCase = selectedType === 'all' || selectedType === 'testCase';
  const selectedFilterLabel =
    MATERIAL_FILTERS.find((filter) => filter.value === selectedType)?.label ?? '物料';
  const selectedMaterialRunsQuery = useLiveQuery(
    () => (selectedId ? listTestRuns(selectedId) : Promise.resolve([] as DecryptedTestRun[])),
    [selectedId]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-muted/10">
      <div className="flex shrink-0 flex-col gap-3 border-b border-border/60 bg-background px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Library className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-foreground">物料库</h2>
              <p className="truncate text-xs text-muted-foreground">D 仔的测试用例资产</p>
            </div>
          </div>
          {canImportTestCase && (
            <Button
              size="sm"
              onClick={() => void onImportTestCase()}
              className="h-8 shrink-0 gap-1.5 rounded-lg px-2.5 text-xs"
            >
              <ClipboardCheck className="h-3.5 w-3.5" />
              导入测试用例
            </Button>
          )}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索物料"
            aria-label="搜索物料"
            className="h-9 rounded-xl border-border/60 bg-muted/20 pl-9 text-xs"
          />
        </div>

        <div
          className="flex items-center gap-1 overflow-x-auto rounded-xl border border-border/60 bg-muted/20 p-0.5"
          role="tablist"
          aria-label="物料分类"
        >
          {MATERIAL_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              role="tab"
              aria-selected={selectedType === filter.value}
              onClick={() => handleTypeChange(filter.value)}
              className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selectedType === filter.value ? 'bg-accent text-accent-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {selectedMaterial ? (
        <TestCaseDetail
          material={selectedMaterial}
          runs={selectedMaterialRunsQuery ?? []}
          runsLoading={selectedMaterialRunsQuery === undefined}
          onBack={() => setSelectedId(null)}
          onExecute={() => void onExecuteTestCase(selectedMaterial)}
        />
      ) : decryptError ? (
        <div className="flex min-h-0 flex-1 items-center justify-center p-6">
          <div className="max-w-sm text-center">
            <h3 className="text-sm font-semibold text-foreground">测试用例内容不可用</h3>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{decryptError}</p>
          </div>
        </div>
      ) : filteredMaterials.length > 0 ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="grid gap-2">
            {filteredMaterials.map((material) => (
              <TestCaseCard
                key={material.id}
                material={material}
                latestRun={latestRuns.get(material.id)}
                onClick={() => setSelectedId(material.id)}
              />
            ))}
          </div>
        </div>
      ) : materialRecords.length > 0 && decryptedMaterials.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center p-6">
          <LoaderCircle className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-6">
          <div className="max-w-xs text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-dashed border-primary/25 bg-primary/5 text-primary">
              <Library className="h-7 w-7" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">
              {selectedType === 'all' ? emptyState.title : `${selectedFilterLabel}暂无物料`}
            </h3>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {search.trim()
                ? `没有匹配的${selectedFilterLabel}。`
                : selectedType === 'all'
                  ? emptyState.description
                  : `当前还没有${selectedFilterLabel}物料。`}
            </p>
            {!search.trim() && canImportTestCase && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void onImportTestCase()}
                className="mt-4 h-8 rounded-lg text-xs"
              >
                导入测试用例
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TestCaseCard({
  material,
  latestRun,
  onClick,
}: {
  material: DecryptedTestCaseMaterial;
  latestRun?: TestRun;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl border border-border/60 bg-background p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium text-foreground">{material.title}</h3>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
            {material.content.definition.goal}
          </p>
        </div>
        <span className="shrink-0 text-[11px] text-muted-foreground">v{material.version}</span>
      </div>
      <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
        <span>{material.content.definition.targets.length} 个目标网页</span>
        <span>{material.content.definition.steps.length} 个步骤</span>
        {latestRun && <RunStatus status={latestRun.status} />}
        <span className="ml-auto">{formatDate(material.updatedAt)}</span>
      </div>
    </button>
  );
}

function TestCaseDetail({
  material,
  runs,
  runsLoading,
  onBack,
  onExecute,
}: {
  material: DecryptedTestCaseMaterial;
  runs: DecryptedTestRun[];
  runsLoading: boolean;
  onBack: () => void;
  onExecute: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const { definition } = material.content;

  if (isEditing) {
    return (
      <TestCaseEditor
        material={material}
        onCancel={() => setIsEditing(false)}
        onSaved={() => setIsEditing(false)}
      />
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="mb-3 h-8 gap-1.5 rounded-lg px-2 text-xs"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        返回列表
      </Button>
      <div className="space-y-4">
        <div>
          <div className="flex items-start justify-between gap-3">
            <h2 className="min-w-0 break-words text-base font-semibold text-foreground">
              {material.title}
            </h2>
            <span className="shrink-0 text-xs text-muted-foreground">v{material.version}</span>
          </div>
          <p className="mt-2 text-sm leading-6 text-foreground">{definition.goal}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            更新于 {formatDate(material.updatedAt)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={onExecute} className="h-8 gap-1.5 rounded-lg text-xs">
              <Play className="h-3.5 w-3.5" />
              执行测试
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="h-8 gap-1.5 rounded-lg text-xs"
            >
              <Pencil className="h-3.5 w-3.5" />
              编辑
            </Button>
          </div>
        </div>

        <DetailSection title="执行历史">
          {runsLoading ? (
            <LoaderCircle className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : runs.length === 0 ? (
            <p className="text-xs text-muted-foreground">还没有执行记录。</p>
          ) : (
            <div className="space-y-2">
              {runs.map((run) => (
                <TestRunReport key={run.id} run={run} />
              ))}
            </div>
          )}
        </DetailSection>

        <DetailSection title="目标网页">
          <ol className="space-y-2">
            {definition.targets.map((target) => (
              <li key={target.id} className="rounded-lg bg-muted/35 px-3 py-2 text-xs">
                <div className="font-medium text-foreground">
                  {target.order}. {target.name || target.id}
                </div>
                <div className="mt-1 break-all text-muted-foreground">{target.url}</div>
              </li>
            ))}
          </ol>
        </DetailSection>

        {definition.preconditions.length > 0 && (
          <DetailSection title="前置条件">
            <ul className="list-disc space-y-1 pl-4 text-xs leading-5 text-muted-foreground">
              {definition.preconditions.map((condition) => (
                <li key={condition}>{condition}</li>
              ))}
            </ul>
          </DetailSection>
        )}

        {definition.testData.length > 0 && (
          <DetailSection title="测试数据">
            <div className="space-y-2">
              {definition.testData.map((item) => (
                <div
                  key={item.name}
                  className="grid grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] gap-3 text-xs"
                >
                  <span className="text-muted-foreground">{item.name}</span>
                  <span className="break-all text-foreground">{item.value}</span>
                </div>
              ))}
            </div>
          </DetailSection>
        )}

        <DetailSection title="测试步骤">
          <ol className="space-y-2">
            {definition.steps.map((step) => (
              <li key={step.id} className="rounded-lg border border-border/50 px-3 py-2 text-xs">
                <div className="font-medium text-foreground">
                  {step.order}. {step.action}
                </div>
                <div className="mt-1 text-muted-foreground">目标：{step.targetId}</div>
                {step.expectedResult && (
                  <div className="mt-1 text-muted-foreground">预期：{step.expectedResult}</div>
                )}
              </li>
            ))}
          </ol>
        </DetailSection>

        {definition.overallExpectedResult && (
          <DetailSection title="整体预期结果">
            <p className="text-xs leading-5 text-muted-foreground">
              {definition.overallExpectedResult}
            </p>
          </DetailSection>
        )}
      </div>
    </div>
  );
}

function TestCaseEditor({
  material,
  onCancel,
  onSaved,
}: {
  material: DecryptedTestCaseMaterial;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [input, setInput] = useState<TestCaseMaterialInput>(() => ({
    title: material.title,
    sourceText: material.content.sourceText,
    definition: {
      ...material.content.definition,
      targets: material.content.definition.targets.map((target, index) => ({
        ...target,
        order: index + 1,
      })),
      preconditions: [...material.content.definition.preconditions],
      testData: material.content.definition.testData.map((item) => ({ ...item })),
      steps: material.content.definition.steps.map((step, index) => ({
        ...step,
        order: index + 1,
      })),
    },
  }));
  const { definition } = input;

  const updateDefinition = (updates: Partial<TestCaseMaterialInput['definition']>) => {
    setInput((current) => ({ ...current, definition: { ...current.definition, ...updates } }));
  };
  const updateTarget = (index: number, updates: Partial<TestCaseTarget>) => {
    const previousId = definition.targets[index]?.id;
    const nextId = updates.id ?? previousId;
    updateDefinition({
      targets: definition.targets.map((target, targetIndex) =>
        targetIndex === index ? { ...target, ...updates } : target
      ),
      ...(previousId && nextId && previousId !== nextId
        ? {
            steps: definition.steps.map((step) =>
              step.targetId === previousId ? { ...step, targetId: nextId } : step
            ),
          }
        : {}),
    });
  };
  const updateStep = (index: number, updates: Partial<TestCaseStep>) => {
    updateDefinition({
      steps: definition.steps.map((step, stepIndex) =>
        stepIndex === index ? { ...step, ...updates } : step
      ),
    });
  };
  const updateTestData = (index: number, updates: Partial<TestCaseTestData>) => {
    updateDefinition({
      testData: definition.testData.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...updates } : item
      ),
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateTestCaseMaterial(material.id, input, material.version);
      toast('测试用例已更新', 'success');
      onSaved();
    } catch (error) {
      logger.error('[MaterialLibrary] Failed to update test case:', error);
      toast(error instanceof Error ? error.message : '更新测试用例失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="h-8 gap-1.5 rounded-lg px-2 text-xs"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          返回详情
        </Button>
        <span className="text-[11px] text-muted-foreground">保存为 v{material.version + 1}</span>
      </div>
      <div className="space-y-4">
        <EditorField label="标题">
          <Input
            value={input.title}
            onChange={(event) => setInput({ ...input, title: event.target.value })}
          />
        </EditorField>
        <EditorField label="原始描述">
          <Textarea
            value={input.sourceText}
            onChange={(event) => setInput({ ...input, sourceText: event.target.value })}
          />
        </EditorField>
        <EditorField label="测试目标">
          <Textarea
            value={definition.goal}
            onChange={(event) => updateDefinition({ goal: event.target.value })}
          />
        </EditorField>

        <EditorField label="目标网页">
          <div className="space-y-2">
            {definition.targets.map((target, index) => (
              <div key={target.id} className="space-y-2 rounded-lg border border-border/50 p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    value={target.id}
                    placeholder="目标 ID"
                    onChange={(event) => updateTarget(index, { id: event.target.value })}
                  />
                  <Input
                    value={target.name ?? ''}
                    placeholder="名称（可选）"
                    onChange={(event) => updateTarget(index, { name: event.target.value })}
                  />
                </div>
                <Input
                  value={target.url}
                  placeholder="https://example.com"
                  onChange={(event) => updateTarget(index, { url: event.target.value })}
                />
                <IconButton
                  label="删除目标网页"
                  disabled={definition.targets.length <= 1}
                  onClick={() =>
                    updateDefinition({
                      targets: definition.targets
                        .filter((_, targetIndex) => targetIndex !== index)
                        .map((item, itemIndex) => ({ ...item, order: itemIndex + 1 })),
                    })
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </IconButton>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                updateDefinition({
                  targets: [
                    ...definition.targets,
                    {
                      id: `target-${definition.targets.length + 1}`,
                      order: definition.targets.length + 1,
                      url: 'https://',
                    },
                  ],
                })
              }
              className="h-8 gap-1.5 rounded-lg text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              添加目标网页
            </Button>
          </div>
        </EditorField>

        <EditorField label="前置条件">
          <Textarea
            value={definition.preconditions.join('\n')}
            placeholder="每行一条"
            onChange={(event) =>
              updateDefinition({ preconditions: splitLines(event.target.value) })
            }
          />
        </EditorField>

        <EditorField label="测试数据">
          <div className="space-y-2">
            {definition.testData.map((item, index) => (
              <div
                key={`${item.name}-${index}`}
                className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]"
              >
                <Input
                  value={item.name}
                  placeholder="名称"
                  onChange={(event) => updateTestData(index, { name: event.target.value })}
                />
                <Input
                  value={item.value}
                  placeholder="值"
                  onChange={(event) => updateTestData(index, { value: event.target.value })}
                />
                <label className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={item.sensitive}
                    onChange={(event) => updateTestData(index, { sensitive: event.target.checked })}
                  />
                  敏感
                </label>
                <IconButton
                  label="删除测试数据"
                  onClick={() =>
                    updateDefinition({
                      testData: definition.testData.filter((_, itemIndex) => itemIndex !== index),
                    })
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </IconButton>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                updateDefinition({
                  testData: [...definition.testData, { name: '', value: '', sensitive: true }],
                })
              }
              className="h-8 gap-1.5 rounded-lg text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              添加测试数据
            </Button>
          </div>
        </EditorField>

        <EditorField label="测试步骤">
          <div className="space-y-2">
            {definition.steps.map((step, index) => (
              <div key={step.id} className="space-y-2 rounded-lg border border-border/50 p-3">
                <div className="grid gap-2 sm:grid-cols-[1fr_1fr]">
                  <Input
                    value={step.id}
                    placeholder="步骤 ID"
                    onChange={(event) => updateStep(index, { id: event.target.value })}
                  />
                  <select
                    value={step.targetId}
                    onChange={(event) => updateStep(index, { targetId: event.target.value })}
                    className="h-9 rounded-xl border border-input bg-background px-3 text-sm text-foreground"
                  >
                    {definition.targets.map((target) => (
                      <option key={target.id} value={target.id}>
                        {target.name || target.id}
                      </option>
                    ))}
                  </select>
                </div>
                <Textarea
                  value={step.action}
                  placeholder="操作"
                  onChange={(event) => updateStep(index, { action: event.target.value })}
                />
                <Textarea
                  value={step.expectedResult ?? ''}
                  placeholder="预期结果（可选）"
                  onChange={(event) => updateStep(index, { expectedResult: event.target.value })}
                />
                <IconButton
                  label="删除测试步骤"
                  disabled={definition.steps.length <= 1}
                  onClick={() =>
                    updateDefinition({
                      steps: definition.steps
                        .filter((_, stepIndex) => stepIndex !== index)
                        .map((item, stepIndex) => ({ ...item, order: stepIndex + 1 })),
                    })
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </IconButton>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                updateDefinition({
                  steps: [
                    ...definition.steps,
                    {
                      id: `step-${definition.steps.length + 1}`,
                      order: definition.steps.length + 1,
                      targetId: definition.targets[0].id,
                      action: '',
                    },
                  ],
                })
              }
              className="h-8 gap-1.5 rounded-lg text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              添加测试步骤
            </Button>
          </div>
        </EditorField>

        <EditorField label="整体预期结果">
          <Textarea
            value={definition.overallExpectedResult ?? ''}
            onChange={(event) => updateDefinition({ overallExpectedResult: event.target.value })}
          />
        </EditorField>

        <div className="flex justify-end gap-2 border-t border-border/50 pt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={saving}
            className="h-8 rounded-lg text-xs"
          >
            取消
          </Button>
          <Button
            size="sm"
            onClick={() => void handleSave()}
            disabled={saving}
            className="h-8 rounded-lg text-xs"
          >
            {saving ? '保存中...' : '保存测试用例'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function EditorField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="block space-y-1.5">
      <span className="text-xs font-semibold text-foreground">{label}</span>
      {children}
    </div>
  );
}

function IconButton({
  label,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function splitLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function TestRunReport({ run }: { run: DecryptedTestRun }) {
  const definition = run.content.testCaseSnapshot;
  const resultByStep = new Map(
    run.content.report.stepResults.map((result) => [result.stepId, result])
  );
  const currentStepIds = new Set(
    run.currentStepIds ?? (run.currentStepId ? [run.currentStepId] : [])
  );
  const currentSteps = definition.steps.filter((step) => currentStepIds.has(step.id));

  return (
    <details className="rounded-lg border border-border/55 bg-background/70 px-3 py-2">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-xs">
        <RunStatus status={run.status} />
        <span className="min-w-0 flex-1 truncate">{formatDate(run.startedAt)}</span>
        <span className="text-[11px] text-muted-foreground">v{run.testCaseVersion}</span>
      </summary>
      <div className="mt-3 space-y-3 border-t border-border/50 pt-3 text-xs">
        <div className="grid grid-cols-2 gap-2 text-muted-foreground">
          <span>开始：{formatDateWithSeconds(run.startedAt)}</span>
          <span>结束：{run.finishedAt ? formatDateWithSeconds(run.finishedAt) : '进行中'}</span>
        </div>
        <div>
          <span className="font-medium text-foreground">目标网页顺序</span>
          <p className="mt-1 break-all leading-5 text-muted-foreground">
            {definition.targets.map((target) => target.url).join(' -> ')}
          </p>
        </div>
        <div>
          <span className="font-medium text-foreground">当前步骤</span>
          <p className="mt-1 text-muted-foreground">
            {currentSteps.length > 0
              ? currentSteps.map((step) => `${step.order}. ${step.action}`).join('；')
              : '无'}
          </p>
        </div>
        <div className="space-y-2">
          <span className="font-medium text-foreground">步骤结果</span>
          {definition.steps.map((step) => {
            const result = resultByStep.get(step.id);
            return <TestStepReport key={step.id} step={step} result={result} />;
          })}
        </div>
        <div>
          <span className="font-medium text-foreground">总结</span>
          <p className="mt-1 whitespace-pre-wrap leading-5 text-muted-foreground">
            {run.content.report.summary || '尚未生成总结。'}
          </p>
        </div>
        {run.content.report.error && (
          <div>
            <span className="font-medium text-destructive">失败、阻塞或停止原因</span>
            <p className="mt-1 whitespace-pre-wrap leading-5 text-destructive/85">
              {run.content.report.error}
            </p>
          </div>
        )}
      </div>
    </details>
  );
}

function TestStepReport({
  step,
  result,
}: {
  step: DecryptedTestRun['content']['testCaseSnapshot']['steps'][number];
  result?: TestStepResult;
}) {
  return (
    <div className="rounded-lg bg-muted/30 px-3 py-2">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0 text-muted-foreground">{step.order}.</span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">{step.action}</p>
          <p className="mt-1 leading-5 text-muted-foreground">
            预期：{step.expectedResult || '未填写'}
          </p>
          <p className="mt-1 leading-5 text-muted-foreground">
            实际：{result?.actualResult || '尚未完成'}
          </p>
          {result?.detail && (
            <p className="mt-1 leading-5 text-muted-foreground">说明：{result.detail}</p>
          )}
        </div>
        {result ? (
          <RunStatus status={result.status} />
        ) : (
          <span className="shrink-0 text-[11px] text-muted-foreground">待执行</span>
        )}
      </div>
    </div>
  );
}

function RunStatus({ status }: { status: TestRunStatus | TestStepResult['status'] }) {
  const config = {
    queued: { label: '排队中', icon: Timer, className: 'text-muted-foreground' },
    running: { label: '执行中', icon: Timer, className: 'text-info' },
    passed: { label: '通过', icon: CheckCircle2, className: 'text-success' },
    failed: { label: '失败', icon: XCircle, className: 'text-destructive' },
    blocked: { label: '阻塞', icon: Ban, className: 'text-warning' },
    stopped: { label: '已停止', icon: Square, className: 'text-muted-foreground' },
    skipped: { label: '已跳过', icon: Square, className: 'text-muted-foreground' },
  }[status];
  const Icon = config.icon;
  return (
    <span className={`flex shrink-0 items-center gap-1 ${config.className}`}>
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </span>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold text-foreground">{title}</h3>
      {children}
    </section>
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

function formatDateWithSeconds(timestamp: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(timestamp);
}
