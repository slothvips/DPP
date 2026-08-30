import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft,
  Copy,
  Eye,
  FileText,
  LoaderCircle,
  Pencil,
  Plus,
  Send,
  Tag,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { TagSelector } from '@/components/ui/tag-selector';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import type {
  DecryptedPromptMaterial,
  PromptMaterialInput,
  PromptVariable,
} from '@/features/aiAssistant/materials/testCaseTypes';
import {
  archivePromptMaterial,
  createOrReactivateTag,
  createPromptMaterial,
  deleteTag,
  extractPromptVariableKeys,
  getAllActiveTags,
  getPromptMaterial,
  listPromptMaterialRecords,
  renderPromptTemplate,
  updatePromptMaterial,
} from '@/lib/db';
import { useConfirmDialog } from '@/utils/confirm-dialog';
import { logger } from '@/utils/logger';

interface PromptMaterialLibraryViewProps {
  search: string;
  compact?: boolean;
  hideEmpty?: boolean;
  onUsePrompt: (prompt: { title: string; body: string }) => Promise<void>;
  onVisibilityChange?: (visible: boolean) => void;
}

export function PromptMaterialLibraryView({
  search,
  compact = false,
  hideEmpty = false,
  onUsePrompt,
  onVisibilityChange,
}: PromptMaterialLibraryViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [usingMaterial, setUsingMaterial] = useState<DecryptedPromptMaterial | null>(null);
  const [decryptedMaterials, setDecryptedMaterials] = useState<DecryptedPromptMaterial[]>([]);
  const [decryptError, setDecryptError] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const materialRecordsQuery = useLiveQuery(() => listPromptMaterialRecords(), []);
  const materialRecords = useMemo(() => materialRecordsQuery ?? [], [materialRecordsQuery]);
  const { confirm } = useConfirmDialog();
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    setDecryptError(null);

    const loadContent = async () => {
      try {
        const results = await Promise.all(
          materialRecords.map(async (material) => {
            try {
              return await getPromptMaterial(material.id);
            } catch (error) {
              logger.warn(`[MaterialLibrary] Failed to decrypt prompt ${material.id}:`, error);
              return undefined;
            }
          })
        );
        const materials = results.flatMap((material) => (material ? [material] : []));
        if (!cancelled) {
          setDecryptedMaterials(materials);
          setDecryptError(
            materials.length < materialRecords.length
              ? '部分提示词无法读取，请检查团队加密密钥'
              : null
          );
        }
      } catch (error) {
        logger.error('[MaterialLibrary] Failed to decrypt prompts:', error);
        if (!cancelled) {
          setDecryptedMaterials([]);
          setDecryptError('无法读取提示词内容，请检查团队加密密钥');
        }
      }
    };

    void loadContent();
    return () => {
      cancelled = true;
    };
  }, [materialRecords]);

  const filteredMaterials = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return decryptedMaterials.filter((material) => {
      if (!keyword) return true;
      const searchable = JSON.stringify(material.content).toLowerCase();
      return material.title.toLowerCase().includes(keyword) || searchable.includes(keyword);
    });
  }, [decryptedMaterials, search]);

  const selectedMaterial = selectedId
    ? decryptedMaterials.find((material) => material.id === selectedId)
    : undefined;
  const isLoading =
    materialRecordsQuery === undefined ||
    (materialRecords.length > 0 && decryptedMaterials.length === 0 && !decryptError);
  const hasVisibleContent =
    isLoading ||
    decryptError !== null ||
    filteredMaterials.length > 0 ||
    selectedMaterial !== undefined ||
    creating ||
    usingMaterial !== null;

  useEffect(() => {
    onVisibilityChange?.(hasVisibleContent);
  }, [hasVisibleContent, onVisibilityChange]);

  const handleArchive = async (material: DecryptedPromptMaterial) => {
    const confirmed = await confirm(
      `确定要归档“${material.title}”吗？\n归档后它不会出现在可用提示词列表中。`,
      '确认归档提示词',
      'danger'
    );
    if (!confirmed) return;

    setArchivingId(material.id);
    try {
      await archivePromptMaterial(material.id);
      if (selectedId === material.id) setSelectedId(null);
      toast('提示词已归档', 'success');
    } catch (error) {
      logger.error('[MaterialLibrary] Failed to archive prompt:', error);
      toast(error instanceof Error ? error.message : '归档提示词失败', 'error');
    } finally {
      setArchivingId(null);
    }
  };

  const handleUse = async (material: DecryptedPromptMaterial, body: string) => {
    try {
      await onUsePrompt({ title: material.title, body });
      setUsingMaterial(null);
    } catch (error) {
      logger.error('[MaterialLibrary] Failed to use prompt:', error);
      toast(error instanceof Error ? error.message : '使用提示词失败', 'error');
    }
  };

  const listContent = (
    <div className="space-y-2">
      {filteredMaterials.map((material) => (
        <PromptMaterialCard
          key={material.id}
          material={material}
          archiving={archivingId === material.id}
          onOpen={() => {
            setEditingId(null);
            setSelectedId(material.id);
          }}
          onUse={() => setUsingMaterial(material)}
          onEdit={() => {
            setEditingId(material.id);
            setSelectedId(material.id);
          }}
          onArchive={() => void handleArchive(material)}
        />
      ))}
    </div>
  );

  const body = selectedMaterial ? (
    editingId === selectedMaterial.id ? (
      <PromptMaterialEditor
        material={selectedMaterial}
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
      <PromptMaterialDetail
        material={selectedMaterial}
        onBack={() => setSelectedId(null)}
        onEdit={() => setEditingId(selectedMaterial.id)}
        onUse={() => setUsingMaterial(selectedMaterial)}
      />
    )
  ) : creating ? (
    <PromptMaterialEditor onCancel={() => setCreating(false)} onSaved={() => setCreating(false)} />
  ) : decryptError ? (
    <div className="flex min-h-0 flex-1 items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <h3 className="text-sm font-semibold text-foreground">提示词内容不可用</h3>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">{decryptError}</p>
      </div>
    </div>
  ) : filteredMaterials.length > 0 ? (
    listContent
  ) : isLoading ? (
    <div className="flex min-h-0 flex-1 items-center justify-center p-6">
      <LoaderCircle className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  ) : compact && hideEmpty ? null : (
    <div className="flex min-h-0 flex-1 items-center justify-center p-6">
      <div className="max-w-xs text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-primary/25 bg-primary/5 text-primary">
          <FileText className="h-6 w-6" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">
          {search.trim() ? '没有匹配的提示词' : '还没有提示词'}
        </h3>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          {search.trim() ? '换一个关键词试试。' : '创建一个可复用的提示词模板。'}
        </p>
        {!search.trim() && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCreating(true)}
            className="mt-4 h-8 gap-1.5 rounded-lg text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            新建提示词
          </Button>
        )}
      </div>
    </div>
  );

  if (compact && hideEmpty && !hasVisibleContent) {
    return null;
  }

  return (
    <div
      className={
        compact
          ? 'rounded-xl border border-border/55 bg-background p-3'
          : 'min-h-0 flex-1 overflow-y-auto p-4'
      }
    >
      {!selectedMaterial && !editingId && !creating && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <h3 className="truncate text-xs font-semibold text-foreground">提示词</h3>
              <p className="truncate text-[11px] text-muted-foreground">
                {materialRecords.length} 条团队共享物料
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setCreating(true)}
            className="h-8 shrink-0 gap-1.5 rounded-lg px-2.5 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            新建
          </Button>
        </div>
      )}
      {body}
      {usingMaterial && (
        <PromptUseDialog
          material={usingMaterial}
          onCancel={() => setUsingMaterial(null)}
          onUse={(rendered) => void handleUse(usingMaterial, rendered)}
        />
      )}
    </div>
  );
}

function PromptMaterialCard({
  material,
  archiving,
  onOpen,
  onUse,
  onEdit,
  onArchive,
}: {
  material: DecryptedPromptMaterial;
  archiving: boolean;
  onOpen: () => void;
  onUse: () => void;
  onEdit: () => void;
  onArchive: () => void;
}) {
  const { content } = material;
  return (
    <article className="w-full rounded-xl border border-border/60 bg-background p-3 transition-colors hover:border-primary/40">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <h3 className="truncate text-sm font-medium text-foreground">{material.title}</h3>
          <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">
            {content.summary || content.body}
          </p>
        </button>
        <span className="shrink-0 text-[11px] text-muted-foreground">v{material.version}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span>{content.variables.length} 个变量</span>
        <span className="ml-auto">{formatDate(material.updatedAt)}</span>
      </div>
      {content.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {content.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              <Tag className="h-3 w-3" />
              {tag}
            </span>
          ))}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={onUse} className="h-8 gap-1.5 rounded-lg text-xs">
          <Send className="h-3.5 w-3.5" />
          使用
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onEdit}
          disabled={archiving}
          className="h-8 gap-1.5 rounded-lg text-xs"
        >
          <Pencil className="h-3.5 w-3.5" />
          编辑
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onArchive}
          disabled={archiving}
          className="h-8 gap-1.5 rounded-lg text-xs text-destructive hover:text-destructive"
        >
          {archiving ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
          归档
        </Button>
      </div>
    </article>
  );
}

function PromptMaterialDetail({
  material,
  onBack,
  onEdit,
  onUse,
}: {
  material: DecryptedPromptMaterial;
  onBack: () => void;
  onEdit: () => void;
  onUse: () => void;
}) {
  const { toast } = useToast();
  const { content } = material;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content.body);
      toast('提示词正文已复制', 'success');
    } catch (error) {
      logger.warn('[MaterialLibrary] Failed to copy prompt:', error);
      toast('复制提示词失败', 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="h-8 gap-1.5 rounded-lg px-2 text-xs"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          返回列表
        </Button>
        <span className="text-[11px] text-muted-foreground">v{material.version}</span>
      </div>
      <div>
        <div className="flex items-start justify-between gap-3">
          <h2 className="min-w-0 break-words text-base font-semibold text-foreground">
            {material.title}
          </h2>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            更新于 {formatDate(material.updatedAt)}
          </span>
        </div>
        {content.summary && (
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{content.summary}</p>
        )}
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold text-foreground">提示词正文</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void handleCopy()}
            className="h-7 gap-1.5 rounded-lg px-2 text-[11px]"
          >
            <Copy className="h-3.5 w-3.5" />
            复制
          </Button>
        </div>
        <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-border/60 bg-muted/25 p-3 text-xs leading-5 text-foreground">
          {content.body}
        </pre>
      </section>

      {content.variables.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold text-foreground">变量</h3>
          <div className="space-y-2">
            {content.variables.map((variable) => (
              <div
                key={variable.key}
                className="rounded-lg border border-border/50 px-3 py-2 text-xs"
              >
                <div className="flex items-center gap-2">
                  <code className="text-primary">
                    {'{{'}
                    {variable.key}
                    {'}}'}
                  </code>
                  <span className="font-medium text-foreground">{variable.label}</span>
                  {variable.required && <span className="text-destructive">必填</span>}
                  {variable.sensitive && <span className="text-warning">敏感</span>}
                </div>
                {variable.description && (
                  <p className="mt-1 leading-5 text-muted-foreground">{variable.description}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex justify-end gap-2 border-t border-border/50 pt-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onEdit}
          className="h-8 gap-1.5 rounded-lg text-xs"
        >
          <Pencil className="h-3.5 w-3.5" />
          编辑
        </Button>
        <Button size="sm" onClick={onUse} className="h-8 gap-1.5 rounded-lg text-xs">
          <Send className="h-3.5 w-3.5" />
          使用提示词
        </Button>
      </div>
    </div>
  );
}

function PromptMaterialEditor({
  material,
  onCancel,
  onSaved,
}: {
  material?: DecryptedPromptMaterial;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [input, setInput] = useState<PromptMaterialInput>(() =>
    material
      ? {
          title: material.title,
          body: material.content.body,
          summary: material.content.summary,
          tags: [...material.content.tags],
          variables: material.content.variables.map((variable) => ({ ...variable })),
        }
      : { title: '', body: '', summary: '', tags: [], variables: [] }
  );

  const updateBody = (body: string) => {
    const existing = new Map(input.variables.map((variable) => [variable.key, variable]));
    const variables = extractPromptVariableKeys(body).map(
      (key): PromptVariable =>
        existing.get(key) || {
          key,
          label: key,
          required: true,
        }
    );
    setInput((current) => ({ ...current, body, variables }));
  };

  const updateVariable = (index: number, updates: Partial<PromptVariable>) => {
    setInput((current) => ({
      ...current,
      variables: current.variables.map((variable, variableIndex) =>
        variableIndex === index ? { ...variable, ...updates } : variable
      ),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (material) {
        await updatePromptMaterial(material.id, input, material.version);
        toast('提示词已更新', 'success');
      } else {
        await createPromptMaterial(input);
        toast('提示词已创建', 'success');
      }
      onSaved();
    } catch (error) {
      logger.error('[MaterialLibrary] Failed to save prompt:', error);
      toast(error instanceof Error ? error.message : '保存提示词失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={saving}
          className="h-8 gap-1.5 rounded-lg px-2 text-xs"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          返回列表
        </Button>
        <span className="text-[11px] text-muted-foreground">
          {material ? `保存为 v${material.version + 1}` : '新建提示词'}
        </span>
      </div>

      <EditorField label="标题">
        <Input
          value={input.title}
          onChange={(event) => setInput((current) => ({ ...current, title: event.target.value }))}
          placeholder="例如：代码审查"
          disabled={saving}
        />
      </EditorField>
      <EditorField label="摘要">
        <Input
          value={input.summary ?? ''}
          onChange={(event) => setInput((current) => ({ ...current, summary: event.target.value }))}
          placeholder="一句话说明使用场景（可选）"
          disabled={saving}
        />
      </EditorField>
      <EditorField label="标签">
        <PromptTagSelector
          tags={input.tags}
          disabled={saving}
          onChange={(tags) => setInput((current) => ({ ...current, tags }))}
        />
      </EditorField>
      <EditorField label="提示词正文">
        <Textarea
          value={input.body}
          onChange={(event) => updateBody(event.target.value)}
          placeholder="输入提示词正文，可使用 {{variable}} 添加变量"
          className="min-h-[220px] resize-y font-mono text-xs leading-5"
          disabled={saving}
        />
      </EditorField>

      {input.variables.length > 0 && (
        <EditorField label="变量定义">
          <div className="space-y-2">
            {input.variables.map((variable, index) => (
              <div
                key={`${variable.key}-${index}`}
                className="space-y-2 rounded-lg border border-border/50 p-3"
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input value={variable.key} disabled placeholder="变量名" />
                  <Input
                    value={variable.label}
                    onChange={(event) => updateVariable(index, { label: event.target.value })}
                    placeholder="显示名称"
                    disabled={saving}
                  />
                </div>
                <Input
                  value={variable.description ?? ''}
                  onChange={(event) => updateVariable(index, { description: event.target.value })}
                  placeholder="变量说明（可选）"
                  disabled={saving}
                />
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={variable.required}
                      onChange={(event) =>
                        updateVariable(index, { required: event.target.checked })
                      }
                      disabled={saving}
                    />
                    必填
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={variable.sensitive === true}
                      onChange={(event) =>
                        updateVariable(index, {
                          sensitive: event.target.checked,
                          ...(event.target.checked ? { defaultValue: undefined } : {}),
                        })
                      }
                      disabled={saving}
                    />
                    敏感输入
                  </label>
                  {!variable.sensitive && (
                    <Input
                      value={variable.defaultValue ?? ''}
                      onChange={(event) =>
                        updateVariable(index, { defaultValue: event.target.value })
                      }
                      placeholder="默认值（可选）"
                      className="h-8 min-w-32 flex-1 text-xs"
                      disabled={saving}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </EditorField>
      )}

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
          {saving ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileText className="h-3.5 w-3.5" />
          )}
          {saving ? '保存中...' : material ? '保存提示词' : '创建提示词'}
        </Button>
      </div>
    </div>
  );
}

function PromptTagSelector({
  tags,
  disabled,
  onChange,
}: {
  tags: string[];
  disabled: boolean;
  onChange: (tags: string[]) => void;
}) {
  const { toast } = useToast();
  const availableTagsQuery = useLiveQuery(() => getAllActiveTags(), []);
  const availableTags = useMemo(() => availableTagsQuery ?? [], [availableTagsQuery]);
  const selectedTagIds = useMemo(() => {
    const names = new Set(tags.map((tag) => tag.toLowerCase()));
    return new Set(
      availableTags.filter((tag) => names.has(tag.name.toLowerCase())).map((tag) => tag.id)
    );
  }, [availableTags, tags]);

  const handleToggle = (tagId: string) => {
    const tag = availableTags.find((item) => item.id === tagId);
    if (!tag) return;
    if (selectedTagIds.has(tagId)) {
      onChange(tags.filter((name) => name.toLowerCase() !== tag.name.toLowerCase()));
    } else {
      onChange([...tags, tag.name]);
    }
  };

  const handleCreate = async (name: string) => {
    const result = await createOrReactivateTag({ name });
    const existing = availableTags.find((tag) => tag.id === result.id);
    const canonicalName = existing?.name ?? name.trim();
    if (!tags.some((tag) => tag.toLowerCase() === canonicalName.toLowerCase())) {
      onChange([...tags, canonicalName]);
    }
  };

  const handleDelete = async (tagId: string, tagName: string) => {
    try {
      await deleteTag({ id: tagId });
      onChange(tags.filter((name) => name.toLowerCase() !== tagName.toLowerCase()));
      toast('标签已删除', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : '删除标签失败', 'error');
    }
  };

  return (
    <div className={disabled ? 'pointer-events-none opacity-60' : undefined}>
      <TagSelector
        availableTags={availableTags}
        selectedTagIds={selectedTagIds}
        onToggleTag={handleToggle}
        onCreateTag={handleCreate}
        onDeleteTag={(tagId, tagName) => void handleDelete(tagId, tagName)}
      />
    </div>
  );
}

function PromptUseDialog({
  material,
  onCancel,
  onUse,
}: {
  material: DecryptedPromptMaterial;
  onCancel: () => void;
  onUse: (body: string) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const { content } = material;
  const preview = (() => {
    try {
      return renderPromptTemplate(content.body, content.variables, values);
    } catch {
      return null;
    }
  })();

  const handleUse = () => {
    try {
      const rendered = renderPromptTemplate(content.body, content.variables, values);
      onUse(rendered);
    } catch (error) {
      setError(error instanceof Error ? error.message : '请补充必填变量');
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl p-4 sm:max-w-lg">
        <DialogHeader className="pr-6 text-left">
          <DialogTitle className="text-sm">使用：{material.title}</DialogTitle>
          <DialogDescription className="text-xs">填写变量后预览并填入当前会话。</DialogDescription>
        </DialogHeader>

        {content.variables.length > 0 && (
          <div className="mt-4 space-y-3">
            {content.variables.map((variable) => (
              <EditorField
                key={variable.key}
                label={`${variable.label}${variable.required ? '（必填）' : ''}`}
              >
                <Input
                  type={variable.sensitive ? 'password' : 'text'}
                  value={values[variable.key] ?? ''}
                  onChange={(event) => {
                    setError(null);
                    setValues((current) => ({ ...current, [variable.key]: event.target.value }));
                  }}
                  placeholder={variable.defaultValue || variable.description || variable.key}
                  autoComplete="off"
                />
              </EditorField>
            ))}
          </div>
        )}

        <div className="mt-4">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Eye className="h-3.5 w-3.5" />
            预览
          </div>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-border/60 bg-muted/25 p-3 text-xs leading-5 text-foreground">
            {preview ?? '请先填写必填变量'}
          </pre>
        </div>
        {error && <p className="mt-3 text-xs text-destructive">{error}</p>}

        <DialogFooter className="mt-4 flex-row justify-end gap-2 border-t border-border/50 pt-3 sm:space-x-0">
          <Button variant="outline" size="sm" onClick={onCancel} className="h-8 rounded-lg text-xs">
            取消
          </Button>
          <Button size="sm" onClick={handleUse} className="h-8 gap-1.5 rounded-lg text-xs">
            <Send className="h-3.5 w-3.5" />
            填入当前会话
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp);
}
