import type { JobItem } from '@/db';

export interface TreeNode {
  job: JobItem;
  children: TreeNode[];
}

export function buildJobTree(jobs: JobItem[]): TreeNode[] {
  const jobMap = new Map<string, TreeNode>();
  const rootNodes: TreeNode[] = [];

  for (const job of jobs) {
    jobMap.set(job.fullName || job.name, { job, children: [] });
  }

  for (const job of jobs) {
    const fullName = job.fullName || job.name;
    const node = jobMap.get(fullName);
    if (!node) continue;

    const parts = fullName.split('/');
    if (parts.length > 1) {
      const parentName = parts.slice(0, -1).join('/');
      const parent = jobMap.get(parentName);
      if (parent) {
        parent.children.push(node);
      } else {
        rootNodes.push(node);
      }
    } else {
      rootNodes.push(node);
    }
  }

  return rootNodes;
}
