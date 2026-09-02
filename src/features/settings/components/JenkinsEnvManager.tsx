import { Plus, Settings } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { JenkinsEnvironment } from '@/db';
import { JenkinsEnvDialog } from './JenkinsEnvDialog';
import { JenkinsEnvList } from './JenkinsEnvList';
import { useJenkinsEnvManager } from './useJenkinsEnvManager';

interface JenkinsEnvManagerProps {
  trigger?: ReactNode;
}

export function JenkinsEnvManager({ trigger }: JenkinsEnvManagerProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const {
    environments,
    currentEnvId,
    isDialogOpen,
    editingEnv,
    setIsDialogOpen,
    handleDelete,
    handleEdit,
    handleAdd,
    handleSetCurrent,
  } = useJenkinsEnvManager();

  const openAddDialog = () => {
    setIsSettingsOpen(false);
    handleAdd();
  };

  const openEditDialog = (env: JenkinsEnvironment) => {
    setIsSettingsOpen(false);
    handleEdit(env);
  };

  return (
    <>
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogTrigger asChild>
          {trigger ?? (
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-xl"
              title="Jenkins 配置"
            >
              <Settings className="h-4 w-4" />
              <span className="sr-only">Jenkins 配置</span>
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Jenkins 配置</DialogTitle>
            <DialogDescription>管理 Jenkins 服务器连接和当前使用的环境。</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-medium">环境列表</h3>
              <Button size="sm" onClick={openAddDialog} className="shrink-0 gap-2">
                <Plus className="h-4 w-4" /> 新增环境
              </Button>
            </div>

            <JenkinsEnvList
              environments={environments}
              currentEnvId={currentEnvId}
              onSetCurrent={handleSetCurrent}
              onEdit={openEditDialog}
              onDelete={handleDelete}
            />
          </div>
        </DialogContent>
      </Dialog>

      <JenkinsEnvDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        initialData={editingEnv}
        existingEnvs={environments}
        currentEnvId={currentEnvId}
      />
    </>
  );
}
