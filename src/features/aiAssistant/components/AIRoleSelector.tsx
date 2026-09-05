import { useLiveQuery } from 'dexie-react-hooks';
import { Check, ChevronDown, LoaderCircle, Plus, ShieldCheck, Trash2 } from 'lucide-react';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import {
  archiveRoleMaterial,
  createRoleMaterial,
  getRoleMaterial,
  listRoleMaterials,
  updateRoleMaterial,
} from '@/lib/db/roles';
import { logger } from '@/utils/logger';
import type {
  AISessionRoleSnapshot,
  DecryptedRoleMaterial,
  RoleMaterialInput,
} from '../materials/testCaseTypes';
import type { AIRoleToolOption } from '../roles/roleRuntime';
import {
  DEFAULT_AI_ROLE_ID,
  createDefaultRoleSnapshot,
  getAvailableRoleTools,
} from '../roles/roleRuntime';

interface AIRoleSelectorProps {
  currentRole: AISessionRoleSnapshot;
  disabled?: boolean;
  onSelect: (roleId: string) => Promise<void>;
}

export function AIRoleSelector({ currentRole, disabled = false, onSelect }: AIRoleSelectorProps) {
  const [open, setOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<DecryptedRoleMaterial | null>(null);
  const [saving, setSaving] = useState(false);
  const roles = useLiveQuery(() => listRoleMaterials(), []);
  const { toast } = useToast();

  const selectRole = async (roleId: string) => {
    setSaving(true);
    try {
      await onSelect(roleId);
      setOpen(false);
    } catch (error) {
      logger.error('[AIRoleSelector] Failed to select role:', error);
      toast(error instanceof Error ? error.message : '切换角色失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openEditor = (role?: DecryptedRoleMaterial) => {
    setEditingRole(role ?? null);
    setEditorOpen(true);
    setOpen(false);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled || saving}
            className="inline-flex max-w-[12rem] items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-lg font-semibold text-primary transition-colors hover:border-primary/50 hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            title="选择角色"
          >
            <span className="truncate">{currentRole.title}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-primary/70" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="center" className="w-[min(22rem,calc(100vw-2rem))] p-2">
          <div className="flex items-center justify-between px-2 py-1.5">
            <div>
              <p className="text-xs font-semibold text-foreground">选择角色</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">角色决定 Prompt 和可用工具</p>
            </div>
          </div>
          <div className="mt-1 max-h-64 space-y-1 overflow-y-auto">
            <RoleOption
              title="D 仔"
              description="处理页面、链接、记录和工程任务。"
              toolCount={createDefaultRoleSnapshot().allowedToolNames.length}
              selected={currentRole.roleId === DEFAULT_AI_ROLE_ID}
              builtIn
              disabled={saving}
              onClick={() => void selectRole(DEFAULT_AI_ROLE_ID)}
            />
            {roles === undefined ? (
              <div className="flex justify-center p-4">
                <LoaderCircle className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : roles.length === 0 ? (
              <p className="px-2 py-3 text-center text-[11px] text-muted-foreground">
                还没有自定义角色
              </p>
            ) : (
              roles.map((role) => (
                <RoleOption
                  key={role.id}
                  title={role.title}
                  description={role.content.description || '自定义 AI 行为和工具范围'}
                  toolCount={
                    role.content.toolPolicy.mode === 'all'
                      ? getAvailableRoleTools().length
                      : role.content.toolPolicy.toolNames.length
                  }
                  selected={currentRole.roleId === role.id}
                  disabled={saving}
                  onClick={() => void selectRole(role.id)}
                  onEdit={async () => {
                    try {
                      const fullRole = await getRoleMaterial(role.id);
                      if (fullRole) openEditor(fullRole);
                    } catch (error) {
                      logger.error('[AIRoleSelector] Failed to load role:', error);
                      toast('无法读取角色内容', 'error');
                    }
                  }}
                />
              ))
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-2 h-8 w-full rounded-md text-xs"
            onClick={() => openEditor()}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            新建角色
          </Button>
        </PopoverContent>
      </Popover>
      <RoleEditorDialog
        role={editingRole}
        open={editorOpen}
        onOpenChange={setEditorOpen}
        onSaved={async (roleId) => {
          const latestRole = await getRoleMaterial(roleId);
          if (latestRole) setEditingRole(latestRole);
          setEditorOpen(false);
          await selectRole(roleId);
        }}
      />
    </>
  );
}

function RoleOption({
  title,
  description,
  toolCount,
  selected,
  builtIn = false,
  disabled = false,
  onClick,
  onEdit,
}: {
  title: string;
  description: string;
  toolCount: number;
  selected: boolean;
  builtIn?: boolean;
  disabled?: boolean;
  onClick: () => void;
  onEdit?: () => Promise<void>;
}) {
  return (
    <div className="group flex items-center gap-1 rounded-md hover:bg-muted/50">
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-2 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          {selected ? <Check className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <span className="truncate">{title}</span>
            {builtIn && <span className="shrink-0 text-[10px] text-muted-foreground">内置</span>}
          </span>
          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
            {description}
          </span>
        </span>
        <span className="shrink-0 text-[10px] text-muted-foreground">{toolCount} 工具</span>
      </button>
      {onEdit && (
        <Button
          variant="ghost"
          size="icon"
          className="mr-1 h-7 w-7 rounded-md opacity-0 group-hover:opacity-100 focus:opacity-100"
          onClick={() => void onEdit()}
          title="编辑角色"
        >
          <span className="text-[11px]">编辑</span>
        </Button>
      )}
    </div>
  );
}

function RoleEditorDialog({
  role,
  open,
  onOpenChange,
  onSaved,
}: {
  role: DecryptedRoleMaterial | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (roleId: string) => Promise<void>;
}) {
  const { toast } = useToast();
  const tools = useMemo(() => getAvailableRoleTools(), []);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(role?.title ?? '');
    setDescription(role?.content.description ?? '');
    setSystemPrompt(role?.content.systemPrompt ?? '');
    setSelectedTools(
      role?.content.toolPolicy.mode === 'all'
        ? tools.map(({ name }) => name)
        : (role?.content.toolPolicy.toolNames ?? [])
    );
  }, [open, role, tools]);

  const toggleTool = (name: string) => {
    setSelectedTools((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name]
    );
  };

  const save = async () => {
    if (!title.trim()) {
      toast('角色名称不能为空', 'error');
      return;
    }
    setSaving(true);
    try {
      const input: RoleMaterialInput = {
        title,
        description,
        systemPrompt,
        toolPolicy: { mode: 'allowlist', toolNames: selectedTools },
      };
      const saved = role
        ? await updateRoleMaterial(role.id, input, role.version)
        : await createRoleMaterial(input);
      await onSaved(saved.id);
    } catch (error) {
      logger.error('[AIRoleSelector] Failed to save role:', error);
      toast(error instanceof Error ? error.message : '保存角色失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!role) return;
    try {
      await archiveRoleMaterial(role.id);
      onOpenChange(false);
      toast('角色已归档', 'success');
    } catch (error) {
      logger.error('[AIRoleSelector] Failed to archive role:', error);
      toast(error instanceof Error ? error.message : '归档角色失败', 'error');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(44rem,calc(100vh-2rem))] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{role ? '编辑角色' : '新建角色'}</DialogTitle>
          <DialogDescription>
            System Prompt 会原样发送给模型，工具权限只影响当前角色。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="角色名称"
            />
            <Input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="一句话描述（可选）"
            />
          </div>
          <Textarea
            value={systemPrompt}
            onChange={(event) => setSystemPrompt(event.target.value)}
            placeholder="输入完整的 system prompt..."
            className="min-h-40 resize-y font-mono text-xs leading-5"
            spellCheck={false}
          />
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground">可用工具</p>
              <span className="text-[11px] text-muted-foreground">
                已选 {selectedTools.length} / {tools.length}
              </span>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {tools.map((tool) => (
                <ToolToggle
                  key={tool.name}
                  tool={tool}
                  checked={selectedTools.includes(tool.name)}
                  onChange={() => toggleTool(tool.name)}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          {role && (
            <Button
              variant="ghost"
              className="mr-auto text-destructive hover:text-destructive"
              onClick={() => void remove()}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              归档
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving && <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            保存并使用
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ToolToggle({
  tool,
  checked,
  onChange,
}: {
  tool: AIRoleToolOption;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onChange}
      className="flex min-w-0 items-start gap-2 rounded-md border border-border/60 px-2.5 py-2 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border ${checked ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/50'}`}
      >
        {checked && <Check className="h-3 w-3" />}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[11px] font-medium text-foreground">{tool.name}</span>
        <span className="mt-0.5 block line-clamp-2 text-[10px] leading-4 text-muted-foreground">
          {tool.description}
          {tool.requiresConfirmation ? ' · 需确认' : ''}
        </span>
      </span>
    </button>
  );
}
