import type { NetworkRequestPhase } from './index';

export function getRequestPhaseLabel(phase: NetworkRequestPhase | undefined): string {
  switch (phase) {
    case 'start':
      return '发送中';
    case 'response-headers':
      return '接收头部';
    case 'response-body':
      return '接收数据';
    case 'complete':
      return '完成';
    case 'error':
      return '错误';
    case 'abort':
      return '已中止';
    default:
      return '未知';
  }
}

export function formatSize(bytes: number | undefined): string {
  if (bytes === undefined) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDuration(ms: number | undefined): string {
  if (ms === undefined) return '-';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function getStatusColor(status: number | undefined): string {
  if (status === undefined) return 'text-muted-foreground';
  if (status >= 200 && status < 300) return 'text-success';
  if (status >= 300 && status < 400) return 'text-warning';
  if (status >= 400 && status < 500) return 'text-warning';
  if (status >= 500) return 'text-destructive';
  return 'text-muted-foreground';
}

export function getMethodColor(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':
      return 'text-info';
    case 'POST':
      return 'text-success';
    case 'PUT':
      return 'text-warning';
    case 'DELETE':
      return 'text-destructive';
    case 'PATCH':
      return 'text-console-debug';
    default:
      return 'text-muted-foreground';
  }
}
