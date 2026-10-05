import { useLiveQuery } from 'dexie-react-hooks';
import { ClipboardCheck, ClipboardCopy, FolderKanban, Library, Plus, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type {
  DecryptedTestCaseMaterial,
  MaterialType,
} from '@/features/aiAssistant/materials/testCaseTypes';
import { getTestCaseMaterial, listTestCaseMaterialRecords } from '@/lib/db';
import { logger } from '@/utils/logger';
import { ConversationMaterialLibraryView } from './ConversationMaterialLibraryView';
import {
  type PromptMaterialFeedItem,
  PromptMaterialLibraryView,
} from './PromptMaterialLibraryView';
import { TestCaseDetail } from './TestCaseDetail';
import { TestCaseEditor } from './TestCaseEditor';
import { TestProjectCreator } from './TestProjectCreator';
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
