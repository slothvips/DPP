import { Copy, Loader2, Upload } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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

const FIELD_OPTIONS = [
  { key: 'name', label: '名称', description: '链接标题' },
  { key: 'url', label: 'URL', description: '链接地址' },
  { key: 'tags', label: '标签', description: '关联的标签' },
  { key: 'note', label: '备注', description: '链接备注说明' },
];

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
  const [selectedFields, setSelectedFields] = useState<string[]>(['name', 'url', 'tags', 'note']);
  const [parsedData, setParsedData] = useState<unknown[] | null>(null);
  const [showFieldSelection, setShowFieldSelection] = useState(false);
  const { bulkAddLinks } = useLinks();
  const { toast } = useToast();

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(AI_PROMPT);
    toast('提示词已复制到剪贴板', 'success');
  };

  const handleParseAndPreview = () => {
    if (!jsonInput.trim()) return;

    try {
      // 1. Parse JSON
      let parsed: unknown[];
      try {
        // Handle potential markdown code blocks from LLM
        const cleanJson = jsonInput.replace(/```json\n?|\n?```/g, '').trim();
        parsed = JSON.parse(cleanJson);
      } catch {
        throw new Error('JSON 格式无效，请检查输入');
      }

      if (!Array.isArray(parsed)) {
        throw new Error('输入必须是 JSON 数组');
      }

      // 2. Validate and prepare data (just to check if there are valid items)
      const validItems = [];
      for (const item of parsed) {
        if (!item || typeof item !== 'object') continue;
        const i = item as Record<string, unknown>;
        if (!i.name || !i.url) continue;
        validItems.push(i);
      }

      if (validItems.length === 0) {
        throw new Error('未找到有效的链接数据（需要 name 和 url 字段）');
      }

      // Show field selection
      setParsedData(parsed);
      setShowFieldSelection(true);
    } catch (e) {
      logger.error('Parse failed', e);
      toast(e instanceof Error ? e.message : '解析失败', 'error');
    }
  };

  const handleImport = async () => {
    if (!parsedData || selectedFields.length === 0) return;

    setIsImporting(true);
    try {
      // 1. Validate and Prepare Data based on selected fields
      const validItems: Array<{ name: string; url: string; note?: string; tags: string[] }> = [];
      const allTagNames = new Set<string>();

      for (const item of parsedData) {
        if (!item || typeof item !== 'object') continue;
        const i = item as Record<string, unknown>;

        // Check required fields
        if (!i.name || !i.url) continue;

        // Always include name and url (required for a valid link)
        const linkItem: { name: string; url: string; note?: string; tags: string[] } = {
          name: String(i.name),
          url: String(i.url),
          tags: [],
        };

        // Only include optional fields if selected
        if (selectedFields.includes('note') && i.note) {
          linkItem.note = String(i.note);
        }
        if (selectedFields.includes('tags') && Array.isArray(i.tags)) {
          linkItem.tags = i.tags.map(String);
          for (const t of i.tags) {
            allTagNames.add(String(t));
          }
        }

        validItems.push(linkItem);
      }

      if (validItems.length === 0) {
        throw new Error('未找到有效的链接数据');
      }

      // 2. Resolve Tags (Name -> ID)
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

      // 3. Transform items with Tag IDs
      const finalItems = validItems.map((item) => ({
        ...item,
        tags: item.tags.map((tagName) => tagMap.get(tagName)).filter((id): id is string => !!id),
      }));

      // 4. Bulk Add
      await bulkAddLinks(finalItems);

      toast(`成功导入 ${validItems.length} 个链接`, 'success');
      resetState();
      if (onImportSuccess) onImportSuccess();
      onClose();
    } catch (e) {
      logger.error('Import failed', e);
      toast(e instanceof Error ? e.message : '导入失败', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const resetState = () => {
    setJsonInput('');
    setParsedData(null);
    setShowFieldSelection(false);
    setSelectedFields(['name', 'url', 'tags', 'note']);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>AI 智能导入</DialogTitle>
          <DialogDescription>
            {showFieldSelection
              ? '选择要导入的字段，然后开始导入'
              : '使用 AI 将任意格式的数据转换为标准格式并导入。'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-6">
          {!showFieldSelection ? (
            <>
              {/* Step 1: Prompt */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold text-primary">
                    第一步：复制提示词给 AI
                  </Label>
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
            </>
          ) : (
            /* Field Selection Step */
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-primary">
                  第三步：选择要导入的字段
                </Label>
                <p className="text-xs text-muted-foreground">
                  勾选您想要导入的字段，未选中的字段将不会被导入
                </p>
              </div>
              <div className="space-y-3">
                {FIELD_OPTIONS.map((field) => (
                  <div key={field.key} className="flex items-center space-x-3">
                    <Checkbox
                      id={`field-${field.key}`}
                      checked={selectedFields.includes(field.key)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedFields([...selectedFields, field.key]);
                        } else {
                          setSelectedFields(selectedFields.filter((f) => f !== field.key));
                        }
                      }}
                    />
                    <Label
                      htmlFor={`field-${field.key}`}
                      className="text-sm font-medium cursor-pointer"
                    >
                      {field.label}
                      <span className="text-muted-foreground text-xs ml-2">
                        {field.description}
                      </span>
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isImporting}>
            {showFieldSelection ? '上一步' : '取消'}
          </Button>
          {!showFieldSelection ? (
            <Button onClick={handleParseAndPreview} disabled={!jsonInput.trim()} className="gap-2">
              <Upload className="h-4 w-4" />
              下一步
            </Button>
          ) : (
            <Button
              onClick={handleImport}
              disabled={isImporting || selectedFields.length === 0}
              className="gap-2"
            >
              {isImporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              开始导入
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
