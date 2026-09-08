import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft,
  ClipboardCheck,
  ClipboardCopy,
  FolderKanban,
  Library,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import type {
  DecryptedTestCaseMaterial,
  MaterialType,
  TestCaseMaterialInput,
  TestCaseStep,
  TestCaseTarget,
  TestCaseTestData,
} from '@/features/aiAssistant/materials/testCaseTypes';
import {
  createTestCaseInProject,
  createTestProject,
  getTestCaseMaterial,
  listTestCaseMaterialRecords,
  updateTestCaseMaterial,
} from '@/lib/db';
import { logger } from '@/utils/logger';
import { ConversationMaterialLibraryView } from './ConversationMaterialLibraryView';
import {
  type PromptMaterialFeedItem,
  PromptMaterialLibraryView,
} from './PromptMaterialLibraryView';
import { TestProjectLibraryView } from './TestProjectLibraryView';

const ALL_EMPTY_STATE_COPY = {
  title: '还没有物料',
  description: '可以先创建提示词，或切换到测试用例分类导入用例。',
};

type MaterialFilter = 'all' | MaterialType | 'testProject';

const MATERIAL_FILTERS: Array<{ value: MaterialFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'prompt', label: '提示词' },
  { value: 'testProject', label: '测试项目' },
  { value: 'conversation', label: '会话' },
];

interface AIMaterialLibraryViewProps {
  onGenerateTestCase: () => Promise<void>;
  onImportTestCase: () => Promise<void>;
  onExecuteTestProject: (project: { id: string; title: string }) => Promise<void>;
  onUseConversation: (materialId: string) => Promise<void>;
}

export function AIMaterialLibraryView({
  onGenerateTestCase,
  onImportTestCase,
  onExecuteTestProject,
  onUseConversation,
}: AIMaterialLibraryViewProps) {
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<MaterialFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creatingProject, setCreatingProject] = useState(false);
  const [creatingProjectId, setCreatingProjectId] = useState<string | null>(null);
  const [decryptedMaterials, setDecryptedMaterials] = useState<DecryptedTestCaseMaterial[]>([]);
  const materialRecordsQuery = useLiveQuery(() => listTestCaseMaterialRecords(), []);
  const materialRecords = useMemo(() => materialRecordsQuery ?? [], [materialRecordsQuery]);

  useEffect(() => {
    let cancelled = false;
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
        }
      } catch (error) {
        logger.error('[MaterialLibrary] Failed to decrypt test cases:', error);
        if (!cancelled) {
          setDecryptedMaterials([]);
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
    setEditingId(null);
    setCreatingProject(false);
    setCreatingProjectId(null);
  };

  const handleCreate = () => {
    setSelectedId(null);
    setEditingId(null);
    setCreatingProject(true);
    setCreatingProjectId(null);
  };

  const selectedMaterial = selectedId
    ? decryptedMaterials.find((material) => material.id === selectedId)
    : undefined;
  const isAllView = selectedType === 'all';

  const testProjectHeader = (
    <div className="shrink-0 border-b border-border/60 bg-background px-4 py-3">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <FolderKanban className="h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <h3 className="truncate text-xs font-semibold text-foreground">测试项目</h3>
            <p className="truncate text-[11px] text-muted-foreground">按项目管理测试执行与结果</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCreate}
          className="h-8 shrink-0 gap-1.5 rounded-lg px-2 text-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          手动创建
        </Button>
      </div>
      <div className="relative mt-3">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-3 left-3 top-3 w-0.5 bg-primary/25 sm:hidden"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-[16.666%] right-[16.666%] top-3 hidden h-0.5 bg-primary/25 sm:block"
        />
        <ol className="relative grid gap-3 sm:grid-cols-3 sm:gap-2" aria-label="测试用例流程">
          <li className="flex min-w-0 items-start gap-3 sm:flex-col sm:items-center">
            <span className="z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground ring-4 ring-background">
              1
            </span>
            <div className="min-w-0 sm:flex sm:flex-col sm:items-center">
              <span className="block truncate text-[11px] font-medium text-primary">
                生成测试用例
              </span>
              <Button
                variant="default"
                size="sm"
                onClick={() => void onGenerateTestCase()}
                aria-label="生成测试用例提示词"
                className="mt-1.5 h-7 w-full max-w-full justify-center gap-1.5 rounded-lg px-2 text-[11px]"
              >
                <ClipboardCopy className="h-3.5 w-3.5" />
                生成测试用例
              </Button>
            </div>
          </li>
          <li className="flex min-w-0 items-start gap-3 sm:flex-col sm:items-center">
            <span className="z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-primary/40 bg-background text-[11px] font-semibold text-primary">
              2
            </span>
            <div className="min-w-0 sm:flex sm:flex-col sm:items-center">
              <span className="block truncate text-[11px] font-medium text-muted-foreground">
                导入生成结果
              </span>
              <Button
                size="sm"
                onClick={() => void onImportTestCase()}
                aria-label="导入生成的测试用例"
                className="mt-1.5 h-7 w-full max-w-full justify-center gap-1.5 rounded-lg px-2 text-[11px]"
              >
                <ClipboardCheck className="h-3.5 w-3.5" />
                导入生成的测试用例
              </Button>
            </div>
          </li>
          <li className="flex min-w-0 items-start gap-3 text-[11px] text-muted-foreground sm:flex-col sm:items-center">
            <span className="z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-primary/40 bg-background text-[11px] font-semibold text-primary">
              3
            </span>
            <span className="truncate sm:mt-1.5">执行并查看报告</span>
          </li>
        </ol>
      </div>
    </div>
  );

  const testCaseContent = creatingProject ? (
    <TestProjectCreator
      embedded={isAllView}
      onCancel={() => setCreatingProject(false)}
      onCreated={(projectId) => {
        setCreatingProject(false);
        setCreatingProjectId(projectId);
      }}
    />
  ) : creatingProjectId ? (
    <TestCaseEditor
      projectId={creatingProjectId}
      embedded={isAllView}
      onCancel={() => setCreatingProjectId(null)}
      onSaved={() => setCreatingProjectId(null)}
    />
  ) : selectedMaterial ? (
    editingId === selectedMaterial.id ? (
      <TestCaseEditor
        material={selectedMaterial}
        embedded={isAllView}
        onCancel={() => {
          setEditingId(null);
          setSelectedId(null);
        }}
        onSaved={() => {
          setEditingId(null);
          setSelectedId(null);
        }}
      />
    ) : (
      <TestCaseDetail
        material={selectedMaterial}
        embedded={isAllView}
        onBack={() => setSelectedId(null)}
        onEdit={() => setEditingId(selectedMaterial.id)}
      />
    )
  ) : null;

  const conversationContent = (
    <ConversationMaterialLibraryView search={search} onUseConversation={onUseConversation} />
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-muted/10">
      <div className="flex shrink-0 flex-col gap-3 border-b border-border/60 bg-background px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Library className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-foreground">物料库</h2>
              <p className="truncate text-xs text-muted-foreground">沉淀与复用 AI 资产</p>
            </div>
          </div>
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

      {selectedType === 'testProject' ? (
        <>
          {testProjectHeader}
          {creatingProject || creatingProjectId || selectedMaterial ? (
            testCaseContent
          ) : (
            <TestProjectLibraryView
              search={search}
              testCases={decryptedMaterials}
              onExecute={onExecuteTestProject}
              onCreateTestCase={(projectId) => {
                setCreatingProjectId(projectId);
                setSelectedId(null);
                setEditingId(null);
              }}
              onEditTestCase={(id) => {
                setEditingId(id);
                setSelectedId(id);
              }}
            />
          )}
        </>
      ) : selectedType === 'conversation' ? (
        conversationContent
      ) : selectedType === 'prompt' ? (
        <PromptMaterialLibraryView key="prompt-library" search={search} />
      ) : isAllView ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {creatingProject || creatingProjectId || selectedMaterial ? (
            testCaseContent
          ) : (
            <TestProjectLibraryView
              search={search}
              testCases={decryptedMaterials}
              onExecute={onExecuteTestProject}
              onCreateTestCase={(projectId) => {
                setCreatingProjectId(projectId);
                setSelectedId(null);
                setEditingId(null);
              }}
              onEditTestCase={(id) => {
                setEditingId(id);
                setSelectedId(id);
              }}
              renderFeed={(projectItems: PromptMaterialFeedItem[]) => (
                <ConversationMaterialLibraryView
                  search={search}
                  onUseConversation={onUseConversation}
                  renderFeed={(conversationItems, conversationItemsLoading) => (
                    <PromptMaterialLibraryView
                      key="prompt-library-mixed"
                      search={search}
                      compact
                      hideHeader
                      additionalItems={[...projectItems, ...conversationItems]}
                      additionalItemsLoading={conversationItemsLoading}
                      emptyState={ALL_EMPTY_STATE_COPY}
                    />
                  )}
                />
              )}
            />
          )}
        </div>
      ) : (
        testCaseContent
      )}
    </div>
  );
}

function TestCaseDetail({
  material,
  embedded = false,
  onBack,
  onEdit,
}: {
  material: DecryptedTestCaseMaterial;
  embedded?: boolean;
  onBack: () => void;
  onEdit: () => void;
}) {
  const { definition } = material.content;

  return (
    <div className={embedded ? 'p-4' : 'min-h-0 flex-1 overflow-y-auto p-4'}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="h-8 gap-1.5 rounded-lg px-2 text-xs"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          返回列表
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onEdit}
          className="h-8 gap-1.5 rounded-lg px-2 text-xs"
        >
          <Pencil className="h-3.5 w-3.5" />
          编辑
        </Button>
      </div>
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
        </div>

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

function TestProjectCreator({
  embedded = false,
  onCancel,
  onCreated,
}: {
  embedded?: boolean;
  onCancel: () => void;
  onCreated: (projectId: string) => void;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const project = await createTestProject({ title, description });
      toast('测试项目已创建，请继续填写测试用例', 'success');
      onCreated(project.id);
    } catch (error) {
      logger.error('[MaterialLibrary] Failed to create test project:', error);
      toast(error instanceof Error ? error.message : '创建测试项目失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={embedded ? 'p-4' : 'min-h-0 flex-1 overflow-y-auto p-4'}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={saving}
          className="h-8 gap-1.5 rounded-lg px-2 text-xs"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          返回项目列表
        </Button>
        <span className="text-[11px] text-muted-foreground">第一步：创建测试项目</span>
      </div>
      <div className="space-y-4">
        <EditorField label="项目名称">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="例如：电商网站回归测试"
          />
        </EditorField>
        <EditorField label="项目描述">
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="描述这个项目覆盖的测试范围（可选）"
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
            className="h-8 gap-1.5 rounded-lg text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            {saving ? '创建中...' : '创建项目并继续'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function createEmptyTestCaseInput(): TestCaseMaterialInput {
  const targetId = 'target-1';
  return {
    title: '',
    sourceText: '',
    definition: {
      goal: '',
      targets: [{ id: targetId, order: 1, url: '' }],
      preconditions: [],
      testData: [],
      steps: [{ id: 'step-1', order: 1, targetId, action: '' }],
    },
  };
}

function TestCaseEditor({
  material,
  projectId,
  embedded = false,
  onCancel,
  onSaved,
}: {
  material?: DecryptedTestCaseMaterial;
  projectId?: string;
  embedded?: boolean;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [input, setInput] = useState<TestCaseMaterialInput>(() =>
    material
      ? {
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
        }
      : createEmptyTestCaseInput()
  );
  const { definition } = input;
  const isCreating = !material;

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
      if (material) {
        await updateTestCaseMaterial(material.id, input, material.version);
        toast('测试用例已更新', 'success');
      } else if (projectId) {
        await createTestCaseInProject(projectId, input);
        toast('测试用例已创建并归入项目', 'success');
      } else {
        throw new Error('请先创建测试项目');
      }
      onSaved();
    } catch (error) {
      logger.error('[MaterialLibrary] Failed to update test case:', error);
      toast(
        error instanceof Error ? error.message : `${isCreating ? '创建' : '更新'}测试用例失败`,
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={embedded ? 'p-4' : 'min-h-0 flex-1 overflow-y-auto p-4'}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="h-8 gap-1.5 rounded-lg px-2 text-xs"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          返回列表
        </Button>
        <span className="text-[11px] text-muted-foreground">
          {isCreating ? '新建测试用例' : `保存为 v${(material?.version ?? 0) + 1}`}
        </span>
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
            {saving ? '保存中...' : isCreating ? '创建测试用例' : '保存测试用例'}
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
