import { Copy, Loader2, Upload } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { db } from '@/db';
import { useLinks } from '@/features/links/hooks/useLinks';
import { logger } from '@/utils/logger';

interface ImportLinksDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess?: () => void;
}

const AI_PROMPT = `Please convert the provided data into a valid JSON array.
Each item in the array must be an object with the following fields:
- "name" (string, required): The title or name of the link.
- "url" (string, required): The valid, direct HTTP/HTTPS URL. IMPORTANT: If the source contains markdown links like "[title](url)", extract ONLY the "url" part.
- "tags" (array of strings, optional): List of tag names (e.g., ["Dev", "Docs"]).
- "note" (string, optional): Any description, credentials, or extra info.

Example format:
[
  {
    "name": "Google",
    "url": "https://google.com",
    "tags": ["Search", "Tool"],
    "note": "Main search engine"
  }
]

Return ONLY the JSON array, no markdown formatting or extra text.`;

export function ImportLinksDialog({ isOpen, onClose, onImportSuccess }: ImportLinksDialogProps) {
  const [jsonInput, setJsonInput] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const { bulkAddLinks } = useLinks();
  const { toast } = useToast();

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(AI_PROMPT);
    toast('提示词已复制到剪贴板', 'success');
  };

  const handleImport = async () => {
    if (!jsonInput.trim()) return;

    setIsImporting(true);
    try {
      // 1. Parse JSON
      let parsedData: unknown[];
      try {
        // Handle potential markdown code blocks from LLM
        const cleanJson = jsonInput.replace(/```json\n?|\n?```/g, '').trim();
        parsedData = JSON.parse(cleanJson);
      } catch {
        throw new Error('JSON 格式无效，请检查输入');
      }

      if (!Array.isArray(parsedData)) {
        throw new Error('输入必须是 JSON 数组');
      }

      // 2. Validate and Prepare Data
      const validItems = [];
      const allTagNames = new Set<string>();

      for (const item of parsedData) {
        if (!item || typeof item !== 'object') continue;
        const i = item as Record<string, unknown>;
        if (!i.name || !i.url) continue;

        validItems.push({
          name: String(i.name),
          url: String(i.url),
          note: i.note ? String(i.note) : undefined,
          tags: Array.isArray(i.tags) ? i.tags.map(String) : [],
        });

        if (Array.isArray(i.tags)) {
          for (const t of i.tags) {
            allTagNames.add(String(t));
          }
        }
      }

      if (validItems.length === 0) {
        throw new Error('未找到有效的链接数据');
      }

      // 3. Resolve Tags (Name -> ID)
      const tagMap = new Map<string, string>(); // Name -> ID

      // Get existing tags
      const existingTags = await db.tags.toArray();
      for (const t of existingTags) {
        tagMap.set(t.name, t.id);
      }

      // Create missing tags
      const newTagsToCreate = Array.from(allTagNames).filter((name) => !tagMap.has(name));

      if (newTagsToCreate.length > 0) {
        const now = Date.now();
        await db.transaction('rw', db.tags, async () => {
          for (const name of newTagsToCreate) {
            // Double check inside transaction
            const existing = await db.tags.where('name').equals(name).first();
            if (existing) {
              tagMap.set(name, existing.id);
            } else {
              const id = crypto.randomUUID();
              await db.tags.add({
                id,
                name,
                color: 'blue', // Default color
                updatedAt: now,
              });
              tagMap.set(name, id);
            }
          }
        });
      }

      // 4. Transform items with Tag IDs
      const finalItems = validItems.map((item) => ({
        ...item,
        tags: item.tags
          .map((tagName: string) => tagMap.get(tagName))
          .filter((id: string | undefined): id is string => !!id),
      }));

      // 5. Bulk Add
      await bulkAddLinks(finalItems);

      toast(`成功导入 ${validItems.length} 个链接`, 'success');
      setJsonInput('');
      if (onImportSuccess) onImportSuccess();
      onClose();
    } catch (e) {
      logger.error('Import failed', e);
      toast(e instanceof Error ? e.message : '导入失败', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>AI 智能导入</DialogTitle>
          <DialogDescription>使用 AI 将任意格式的数据转换为标准格式并导入。</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-6">
          {/* Step 1: Prompt */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold text-primary">第一步：复制提示词给 AI</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyPrompt}
                className="h-7 text-xs gap-1"
              >
                <Copy className="h-3 w-3" />
                复制提示词
              </Button>
            </div>
            <div className="bg-muted/50 p-3 rounded-md text-xs font-mono text-muted-foreground whitespace-pre-wrap border h-32 overflow-y-auto">
              {AI_PROMPT}
            </div>
            <p className="text-xs text-muted-foreground">
              将此提示词发送给 ChatGPT、Claude 或
              DeepSeek，然后把你要导入的数据（文本、Excel、表格等）贴给它。
            </p>
          </div>

          {/* Step 2: Input */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-primary">
              第二步：粘贴 AI 返回的 JSON
            </Label>
            <Textarea
              placeholder='[{"name": "Example", "url": "..."}]'
              className="font-mono text-xs min-h-[150px]"
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isImporting}>
            取消
          </Button>
          <Button
            onClick={handleImport}
            disabled={isImporting || !jsonInput.trim()}
            className="gap-2"
          >
            {isImporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            开始导入
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
