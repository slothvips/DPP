import { ArrowLeft, Check, Copy, Pencil, Plus, Settings, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useAIConfigDialog } from '../hooks/useAIConfigDialog';
import { isAIConfigConfigured } from '../lib/aiConfigStorage';
import { AIConfigFormFields } from './AIConfigFormFields';
import { getProviderLabel } from './aiConfigDialogShared';

interface AIConfigDialogProps {
  children?: React.ReactNode;
  onSaved?: () => void;
}

export function AIConfigDialog({ children, onSaved }: AIConfigDialogProps) {
  const [open, setOpen] = useState(false);
  const config = useAIConfigDialog(open, onSaved);
  const isNew = config.provider !== 'opencode' && !config.selectedProfileId;
  const selectedProfile = config.profiles.find(
    (profile) => profile.id === config.selectedProfileId
  );
  const selectedProfileIsActive =
    config.activeProvider !== 'opencode' && selectedProfile?.isActive === true;

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setOpen(true);
      return;
    }
    void config.confirmDiscard().then((canClose) => {
      if (canClose) setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="ghost" size="sm" title="AI 设置">
            <Settings className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[min(88vh,760px)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden border-border/60 bg-background/96 p-0 sm:max-w-[560px]">
        {config.view === 'list' ? (
          <>
            <DialogHeader className="border-b border-border/60 px-5 py-4 pr-12">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <DialogTitle>AI 服务配置</DialogTitle>
                  <DialogDescription className="mt-1">
                    当前服务只会通过“使用”按钮切换
                  </DialogDescription>
                </div>
                <Button size="sm" onClick={config.handleAdd} disabled={config.loading}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  添加服务
                </Button>
              </div>
            </DialogHeader>

            <div className="min-h-0 overflow-y-auto px-5 py-3 custom-scrollbar">
              {config.loading && config.profiles.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">正在读取配置...</p>
              ) : (
                <div className="divide-y divide-border/60 border-y border-border/60">
                  <div className="flex min-h-16 items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">OpenCode Free</p>
                        {config.activeProvider === 'opencode' && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded bg-success/10 px-1.5 py-0.5 text-[11px] font-medium text-success">
                            <Check className="h-3 w-3" />
                            当前使用
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        内置服务 · {config.openCodeConfig.model}
                      </p>
                    </div>
                    {config.activeProvider !== 'opencode' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void config.handleActivate('opencode')}
                        disabled={config.loading}
                      >
                        使用
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={config.handleEditOpenCode}
                      disabled={config.loading}
                      aria-label="编辑 OpenCode Free"
                      title="编辑 OpenCode Free"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>

                  {config.profiles.map((profile) => {
                    const isActive = config.activeProvider !== 'opencode' && profile.isActive;
                    return (
                      <div key={profile.id} className="flex min-h-16 items-center gap-3 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium">{profile.name}</p>
                            {isActive && (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded bg-success/10 px-1.5 py-0.5 text-[11px] font-medium text-success">
                                <Check className="h-3 w-3" />
                                当前使用
                              </span>
                            )}
                          </div>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {getProviderLabel(profile.provider)} · {profile.model}
                          </p>
                        </div>
                        {!isActive && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void config.handleActivate(profile.id)}
                            disabled={config.loading}
                          >
                            使用
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => config.handleEditProfile(profile.id)}
                          disabled={config.loading}
                          aria-label={`编辑 ${profile.name}`}
                          title={`编辑 ${profile.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <DialogHeader className="border-b border-border/60 px-5 py-4 pr-12">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => void config.handleBack()}
                  aria-label="返回配置列表"
                  title="返回配置列表"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-0">
                  <DialogTitle className="truncate">
                    {isNew ? '添加 AI 服务' : `编辑 ${config.profileName}`}
                  </DialogTitle>
                  <DialogDescription className="mt-1">
                    保存配置不会切换当前使用的服务
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="min-h-0 overflow-y-auto px-5 py-4 custom-scrollbar">
              <AIConfigFormFields
                provider={config.provider}
                baseUrl={config.baseUrl}
                model={config.model}
                apiKey={config.apiKey}
                contextWindow={config.contextWindow}
                profileName={config.profileName}
                isNew={isNew}
                errors={config.errors}
                onProviderChange={config.handleProviderChange}
                onBaseUrlChange={config.setBaseUrl}
                onModelChange={config.setModel}
                onApiKeyChange={config.setApiKey}
                onContextWindowChange={config.setContextWindow}
                onProfileNameChange={config.setProfileName}
                onClearError={config.clearError}
                modelOptions={config.modelOptions}
                modelsLoading={config.modelsLoading}
                modelLoadError={config.modelLoadError}
                onRefreshModels={() => void config.refreshModels()}
              />
            </div>

            <DialogFooter className="border-t border-border/60 px-5 py-3 sm:justify-between">
              <div className="flex items-center gap-1">
                {config.selectedProfileId && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void config.handleDuplicateProfile()}
                      disabled={config.loading || config.isDirty}
                      title={config.isDirty ? '请先保存当前修改' : '复制配置'}
                    >
                      <Copy className="mr-1.5 h-4 w-4" />
                      复制配置
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-destructive hover:text-destructive"
                      onClick={() => void config.handleDeleteProfile()}
                      disabled={config.loading || selectedProfileIsActive}
                      aria-label={selectedProfileIsActive ? '当前配置不能删除' : '删除配置'}
                      title={selectedProfileIsActive ? '请先切换到其他服务' : '删除配置'}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button variant="outline" onClick={() => void config.handleBack()}>
                  取消
                </Button>
                <Button onClick={() => void config.handleSave()} disabled={config.loading}>
                  {config.loading ? '保存中...' : isNew ? '保存配置' : '保存更改'}
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export { isAIConfigConfigured };
