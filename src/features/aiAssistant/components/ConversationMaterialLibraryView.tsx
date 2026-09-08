import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, BookOpen, Copy, LoaderCircle, Share2 } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { createConversationMaterialDeepLink } from '@/features/aiAssistant/materials/materialDeepLink';
import { getConversationMaterial, listConversationMaterialRecords } from '@/lib/db/conversations';
import { logger } from '@/utils/logger';
import type { DecryptedConversationMaterial } from '../materials/testCaseTypes';
import { MessageItem } from './MessageItem';

interface ConversationMaterialLibraryViewProps {
  search: string;
  onUseConversation: (materialId: string) => Promise<void>;
  renderFeed?: (
    items: Array<{ id: string; updatedAt: number; content: ReactNode }>,
    loading: boolean
  ) => ReactNode;
}

export function ConversationMaterialLibraryView({
  search,
  onUseConversation,
  renderFeed,
}: ConversationMaterialLibraryViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [decryptedMaterials, setDecryptedMaterials] = useState<DecryptedConversationMaterial[]>([]);
  const [decryptError, setDecryptError] = useState<string | null>(null);
  const [usingId, setUsingId] = useState<string | null>(null);
  const materialRecordsQuery = useLiveQuery(() => listConversationMaterialRecords(), []);
  const materialRecords = useMemo(() => materialRecordsQuery ?? [], [materialRecordsQuery]);
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    setDecryptError(null);

    const loadContent = async () => {
      try {
        const results = await Promise.all(
          materialRecords.map(async (material) => {
            try {
              return await getConversationMaterial(material.id);
            } catch (error) {
              logger.warn(
                `[MaterialLibrary] Failed to decrypt conversation ${material.id}:`,
                error
              );
              return undefined;
            }
          })
        );
        const materials = results.flatMap((material) => (material ? [material] : []));
        if (!cancelled) {
          setDecryptedMaterials(materials);
          setDecryptError(
            materials.length < materialRecords.length
              ? '部分会话无法读取，请检查团队加密密钥'
              : null
          );
        }
      } catch (error) {
        logger.error('[MaterialLibrary] Failed to decrypt conversations:', error);
        if (!cancelled) {
          setDecryptedMaterials([]);
          setDecryptError('无法读取会话内容，请检查团队加密密钥');
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

  const handleUse = async (materialId: string) => {
    setUsingId(materialId);
    try {
      await onUseConversation(materialId);
      toast('已带到新的本地会话', 'success');
    } catch (error) {
      logger.error('[MaterialLibrary] Failed to import conversation:', error);
      toast(error instanceof Error ? error.message : '导入会话失败', 'error');
    } finally {
      setUsingId(null);
    }
  };

  const handleCopyLink = async (materialId: string) => {
    try {
      await navigator.clipboard.writeText(createConversationMaterialDeepLink(materialId));
      toast('DPP 链接已复制', 'success');
    } catch (error) {
      logger.warn('[MaterialLibrary] Failed to copy material link:', error);
      toast('复制链接失败，请重试', 'error');
    }
  };

  if (renderFeed) {
    if (selectedMaterial) {
      return (
        <div className="p-4">
          <ConversationMaterialDetail
            material={selectedMaterial}
            using={usingId === selectedMaterial.id}
            onBack={() => setSelectedId(null)}
            onUse={() => void handleUse(selectedMaterial.id)}
            onCopyLink={() => void handleCopyLink(selectedMaterial.id)}
          />
        </div>
      );
    }

    const items = filteredMaterials.map((material) => ({
      id: material.id,
      updatedAt: material.updatedAt,
      content: (
        <ConversationMaterialCard
          material={material}
          using={usingId === material.id}
          onOpen={() => setSelectedId(material.id)}
          onUse={() => void handleUse(material.id)}
          onCopyLink={() => void handleCopyLink(material.id)}
        />
      ),
    }));

    return (
      <>
        {renderFeed(items, isLoading)}
        {decryptError && (
          <p className="px-4 pb-4 text-xs text-destructive" role="status">
            {decryptError}
          </p>
        )}
      </>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      {!selectedMaterial && (
        <div className="mb-3 flex items-center gap-2">
          <BookOpen className="h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <h3 className="truncate text-xs font-semibold text-foreground">会话</h3>
            <p className="truncate text-[11px] text-muted-foreground">
              {materialRecords.length} 条永久共享会话
            </p>
          </div>
        </div>
      )}

      {selectedMaterial ? (
        <ConversationMaterialDetail
          material={selectedMaterial}
          using={usingId === selectedMaterial.id}
          onBack={() => setSelectedId(null)}
          onUse={() => void handleUse(selectedMaterial.id)}
          onCopyLink={() => void handleCopyLink(selectedMaterial.id)}
        />
      ) : decryptError ? (
        <div className="flex min-h-0 items-center justify-center p-6">
          <div className="max-w-sm text-center">
            <h3 className="text-sm font-semibold text-foreground">会话内容不可用</h3>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{decryptError}</p>
          </div>
        </div>
      ) : isLoading ? (
        <div className="flex min-h-0 items-center justify-center p-6">
          <LoaderCircle className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filteredMaterials.length > 0 ? (
        <div className="space-y-2">
          {filteredMaterials.map((material) => (
            <ConversationMaterialCard
              key={material.id}
              material={material}
              using={usingId === material.id}
              onOpen={() => setSelectedId(material.id)}
              onUse={() => void handleUse(material.id)}
              onCopyLink={() => void handleCopyLink(material.id)}
            />
          ))}
        </div>
      ) : (
        <div className="flex min-h-0 items-center justify-center p-6">
          <div className="max-w-xs text-center">
            <BookOpen className="mx-auto h-8 w-8 text-muted-foreground/60" />
            <h3 className="mt-3 text-sm font-semibold text-foreground">
              {search.trim() ? '没有匹配的会话' : '还没有永久共享会话'}
            </h3>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {search.trim() ? '换一个关键词试试。' : '可以从对话工具栏永久分享一段完整会话。'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function ConversationMaterialCard({
  material,
  using,
  onOpen,
  onUse,
  onCopyLink,
}: {
  material: DecryptedConversationMaterial;
  using: boolean;
  onOpen: () => void;
  onUse: () => void;
  onCopyLink: () => void;
}) {
  const toolCalls = material.content.messages.reduce(
    (count, message) => count + (message.toolCalls?.length ?? 0),
    0
  );
  const toolResults = material.content.messages.filter((message) => message.role === 'tool').length;

  return (
    <article className="w-full rounded-xl border border-border/60 bg-background p-3 transition-colors hover:border-primary/40">
      <button
        type="button"
        onClick={onOpen}
        className="w-full min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex items-start gap-2">
          <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
            会话
          </span>
          <h3 className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
            {material.title}
          </h3>
          <span className="shrink-0 text-[11px] text-muted-foreground">永久</span>
        </div>
        <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">
          {material.content.summary || getConversationPreview(material)}
        </p>
      </button>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span>{material.content.messages.length} 条消息</span>
        <span>{toolCalls} 次工具调用</span>
        <span>{toolResults} 条工具结果</span>
        <span className="ml-auto">{formatDate(material.updatedAt)}</span>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onCopyLink}
          className="h-8 gap-1.5 rounded-lg text-xs"
        >
          <Copy className="h-3.5 w-3.5" />
          复制链接
        </Button>
        <Button
          size="sm"
          onClick={onUse}
          disabled={using}
          className="h-8 gap-1.5 rounded-lg text-xs"
        >
          {using ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Share2 className="h-3.5 w-3.5" />
          )}
          带到我的会话
        </Button>
      </div>
    </article>
  );
}

export function ConversationMaterialDetail({
  material,
  using,
  onBack,
  onUse,
  onCopyLink,
  showBack = true,
}: {
  material: DecryptedConversationMaterial;
  using: boolean;
  onBack?: () => void;
  onUse: () => void;
  onCopyLink: () => void;
  showBack?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        {showBack && onBack ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="h-8 gap-1.5 rounded-lg px-2 text-xs"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            返回列表
          </Button>
        ) : (
          <span />
        )}
        <span className="text-[11px] text-muted-foreground">
          永久物料 · {formatDate(material.updatedAt)}
        </span>
      </div>
      <div>
        <h2 className="break-words text-base font-semibold text-foreground">{material.title}</h2>
        {material.content.summary && (
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{material.content.summary}</p>
        )}
        <p className="mt-1 text-[11px] text-muted-foreground">
          {material.content.messages.length} 条消息 · 完整保留工具调用与执行结果
        </p>
      </div>
      <div className="space-y-1">
        {material.content.messages.map((message) => (
          <MessageItem
            key={message.id}
            message={message}
            canEdit={false}
            assistantLabel={material.content.role?.title ?? 'AI 助手'}
            onEditMessage={ignoreEditMessage}
          />
        ))}
      </div>
      <div className="flex justify-end gap-2 border-t border-border/50 pt-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onCopyLink}
          className="h-8 gap-1.5 rounded-lg text-xs"
        >
          <Copy className="h-3.5 w-3.5" />
          复制链接
        </Button>
        <Button onClick={onUse} disabled={using} className="h-8 gap-1.5 rounded-lg text-xs">
          {using ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Share2 className="h-3.5 w-3.5" />
          )}
          带到我的会话
        </Button>
      </div>
    </div>
  );
}

function getConversationPreview(material: DecryptedConversationMaterial): string {
  return (
    material.content.messages.find((message) => message.content.trim())?.content || '完整会话历史'
  );
}

async function ignoreEditMessage(): Promise<void> {}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp);
}
