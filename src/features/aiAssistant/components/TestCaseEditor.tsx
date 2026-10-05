import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import type {
  DecryptedTestCaseMaterial,
  TestCaseMaterialInput,
  TestCaseStep,
  TestCaseTarget,
  TestCaseTestData,
} from '@/features/aiAssistant/materials/testCaseTypes';
import { createTestCaseInProject, updateTestCaseMaterial } from '@/lib/db';
import { logger } from '@/utils/logger';
import { EditorField, IconButton, splitLines } from './materialLibraryShared';

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

export function TestCaseEditor({
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
