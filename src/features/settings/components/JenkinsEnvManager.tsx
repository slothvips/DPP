import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { JenkinsEnvDialog } from './JenkinsEnvDialog';
import { JenkinsEnvList } from './JenkinsEnvList';
import { useJenkinsEnvManager } from './useJenkinsEnvManager';

export function JenkinsEnvManager() {
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

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">环境列表</h3>
        <Button size="sm" onClick={handleAdd} className="gap-2">
          <Plus className="w-4 h-4" /> 新增环境
        </Button>
      </div>

      <JenkinsEnvList
        environments={environments}
        currentEnvId={currentEnvId}
        onSetCurrent={handleSetCurrent}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <JenkinsEnvDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        initialData={editingEnv}
        existingEnvs={environments}
        currentEnvId={currentEnvId}
      />
    </div>
  );
}
