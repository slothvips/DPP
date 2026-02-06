export function getJobColorClass(color?: string): string {
  if (!color) return 'text-muted-foreground';
  if (color.startsWith('blue')) return 'text-info';
  if (color.startsWith('red')) return 'text-destructive';
  if (color.startsWith('yellow')) return 'text-warning';
  if (color.startsWith('aborted')) return 'text-muted-foreground';
  if (color.includes('_anime')) return 'text-info animate-pulse';
  return 'text-muted-foreground';
}

export function getStatusDotColor(status?: string): string {
  if (!status) return '#9ca3af'; // gray-400
  switch (status) {
    case 'SUCCESS':
      return '#22c55e'; // green-500
    case 'FAILURE':
      return '#ef4444'; // red-500
    case 'ABORTED':
      return '#9ca3af'; // gray-400
    case 'UNSTABLE':
      return '#eab308'; // yellow-500
    case 'Building':
      return '#3b82f6'; // blue-500
    default:
      return '#9ca3af';
  }
}

export function getStatusClassName(status?: string): string {
  if (!status) return 'text-muted-foreground border-transparent';
  switch (status) {
    case 'SUCCESS':
      return 'text-success bg-success/20 border-success/30';
    case 'FAILURE':
      return 'text-destructive bg-destructive/20 border-destructive/30';
    case 'ABORTED':
      return 'text-muted-foreground bg-muted border-border';
    case 'UNSTABLE':
      return 'text-warning bg-warning/20 border-warning/30';
    case 'Building':
      return 'text-info bg-info/20 border-info/30 animate-pulse';
    default:
      return 'text-muted-foreground bg-muted/50 border-border';
  }
}

export function translateStatus(status?: string): string {
  if (!status) return '';
  switch (status) {
    case 'SUCCESS':
      return '成功';
    case 'FAILURE':
      return '失败';
    case 'ABORTED':
      return '取消';
    case 'UNSTABLE':
      return '不稳定';
    case 'Building':
      return '构建中';
    case 'Unknown':
      return '未知';
    default:
      return status;
  }
}

export function isFolder(job: { type?: string }, childrenCount = 0): boolean {
  return (
    job.type?.includes('Folder') ||
    job.type?.includes('WorkflowMultiBranchProject') ||
    childrenCount > 0
  );
}
