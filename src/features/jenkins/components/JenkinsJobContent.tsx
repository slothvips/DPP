import { ChevronsDownUp, ChevronsUpDown, Clock, Terminal } from 'lucide-react';
import { type KeyboardEvent, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { VirtualList, type VirtualListHandle } from '@/components/ui/virtual-list';
import type { JobItem, TagItem } from '@/db';
import { JobTreeNode } from '@/features/jenkins/components/JobTreeNode';
import {
  JENKINS_SELECT_TRIGGER_CLASS,
  JenkinsBadge,
  JenkinsEmptyState,
  JenkinsPanel,
  JenkinsPanelHeader,
} from '@/features/jenkins/components/jenkinsUi';
import type {
  JenkinsJobActivity,
  JenkinsJobSort,
  JenkinsJobStatusFilter,
} from '@/features/jenkins/components/useJenkinsView';
import type { JenkinsRecentJob } from '@/features/jenkins/recentJobs';
import type { TreeNode } from '@/features/jenkins/utils';

interface JenkinsJobContentProps {
  hasActiveFilter: boolean;
  expandedUrls: Set<string>;
  filteredJobs: JobItem[];
  jobTree: TreeNode[];
  jobs: JobItem[];
  loading: boolean;
  onBuild?: (job: JobItem) => void;
  onDetails: (job: JobItem) => void;
  onToggle: (url: string) => void;
  jobActivity?: Map<string, JenkinsJobActivity>;
  recentJobs: JenkinsRecentJob[];
  onOpenRecent: (job: JenkinsRecentJob) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  statusFilter: JenkinsJobStatusFilter;
  onStatusFilterChange: (value: JenkinsJobStatusFilter) => void;
  tagFilterId: string;
  onTagFilterChange: (value: string) => void;
  sortBy: JenkinsJobSort;
  onSortChange: (value: JenkinsJobSort) => void;
  tags: TagItem[];
}

interface TreeRow {
  job: JobItem;
  depth: number;
  isFolder: boolean;
  isExpanded: boolean;
}

const STATUS_FILTER_LABELS: Record<JenkinsJobStatusFilter, string> = {
  all: '全部状态',
  failed: '失败',
  building: '构建中',
  success: '成功',
  unbuilt: '未构建',
};

const SORT_LABELS: Record<JenkinsJobSort, string> = {
  name: '按名称',
  recent: '按最近构建',
  status: '按状态',
};

function flattenVisibleNodes(nodes: TreeNode[], expandedUrls: Set<string>): TreeRow[] {
  const rows: TreeRow[] = [];
  const walk = (list: TreeNode[], depth: number) => {
    for (const node of list) {
      const isFolder = node.children.length > 0;
      const isExpanded = isFolder && expandedUrls.has(node.job.url);
      rows.push({ job: node.job, depth, isFolder, isExpanded });
      if (isExpanded) walk(node.children, depth + 1);
    }
  };
  walk(nodes, 0);
  return rows;
}

export function JenkinsJobContent({
  hasActiveFilter,
  expandedUrls,
  filteredJobs,
  jobTree,
  jobs,
  loading,
  onBuild,
  onDetails,
  onToggle,
  jobActivity,
  recentJobs,
  onOpenRecent,
  onExpandAll,
  onCollapseAll,
  statusFilter,
  onStatusFilterChange,
  tagFilterId,
  onTagFilterChange,
  sortBy,
  onSortChange,
  tags,
}: JenkinsJobContentProps) {
  const hasJobs = jobs.length > 0;
  const listHandleRef = useRef<VirtualListHandle | null>(null);

  const rows = useMemo<TreeRow[]>(() => {
    if (hasActiveFilter) {
      return filteredJobs.map((job) => ({ job, depth: 0, isFolder: false, isExpanded: false }));
    }
    return flattenVisibleNodes(jobTree, expandedUrls);
  }, [expandedUrls, filteredJobs, hasActiveFilter, jobTree]);

  const focusRowAt = (index: number) => {
    listHandleRef.current?.scrollToIndex(index);
    const focus = () =>
      document.querySelector<HTMLElement>(`[data-job-index="${index}"] [data-job-row]`)?.focus();
    requestAnimationFrame(() => {
      if (!document.querySelector(`[data-job-index="${index}"]`)) setTimeout(focus, 0);
      else focus();
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const rowEl = target.closest<HTMLElement>('[data-job-index]');
    if (!rowEl) return;
    const currentIndex = Number(rowEl.dataset.jobIndex);
    const row = rows[currentIndex];
    if (!row) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = currentIndex + (event.key === 'ArrowDown' ? 1 : -1);
      if (next >= 0 && next < rows.length) focusRowAt(next);
      return;
    }
    if (!row.isFolder) return;
    if (event.key === 'ArrowRight' && !row.isExpanded) {
      event.preventDefault();
      onToggle(row.job.url);
    } else if (event.key === 'ArrowLeft' && row.isExpanded) {
      event.preventDefault();
      onToggle(row.job.url);
    }
  };

  return (
    <JenkinsPanel>
      <JenkinsPanelHeader
        icon={<Terminal className="h-4 w-4 text-primary" />}
        title="任务"
        badge={
          hasJobs ? (
            <JenkinsBadge>
              {hasActiveFilter ? `${filteredJobs.length}/${jobs.length}` : jobs.length}
            </JenkinsBadge>
          ) : undefined
        }
      >
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1 px-1.5 text-xs text-muted-foreground"
          onClick={onExpandAll}
          title="全部展开"
        >
          <ChevronsUpDown className="h-3.5 w-3.5" />
          展开
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1 px-1.5 text-xs text-muted-foreground"
          onClick={onCollapseAll}
          title="全部收起"
        >
          <ChevronsDownUp className="h-3.5 w-3.5" />
          收起
        </Button>
      </JenkinsPanelHeader>
      {hasJobs && (
        <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border/50 px-2.5 py-1.5">
          <Select
            value={statusFilter}
            onValueChange={(value) => onStatusFilterChange(value as JenkinsJobStatusFilter)}
          >
            <SelectTrigger className={JENKINS_SELECT_TRIGGER_CLASS}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(STATUS_FILTER_LABELS) as JenkinsJobStatusFilter[]).map((value) => (
                <SelectItem key={value} value={value} className="text-xs">
                  {STATUS_FILTER_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={tagFilterId || 'all'}
            onValueChange={(value) => onTagFilterChange(value === 'all' ? '' : value)}
          >
            <SelectTrigger className={JENKINS_SELECT_TRIGGER_CLASS}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                全部标签
              </SelectItem>
              {tags.map((tag) => (
                <SelectItem key={tag.id} value={tag.id} className="text-xs">
                  {tag.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(value) => onSortChange(value as JenkinsJobSort)}>
            <SelectTrigger className={JENKINS_SELECT_TRIGGER_CLASS}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_LABELS) as JenkinsJobSort[]).map((value) => (
                <SelectItem key={value} value={value} className="text-xs">
                  {SORT_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {!hasActiveFilter && recentJobs.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border/50 px-2.5 py-1.5">
          <span className="mr-1 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            最近使用
          </span>
          {recentJobs.map((ref) => (
            <button
              key={`${ref.envId}:${ref.url}`}
              type="button"
              className="max-w-[10rem] truncate rounded-full border border-border/60 bg-muted/50 px-2 py-0.5 text-xs text-foreground hover:border-primary/40 hover:bg-accent"
              title={ref.name}
              onClick={() => onOpenRecent(ref)}
            >
              {ref.name}
            </button>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 p-2" onKeyDown={handleKeyDown}>
        {!hasJobs ? (
          <JenkinsEmptyState>
            {loading ? '正在从 Jenkins 获取数据...' : '暂无数据，请点击采集'}
          </JenkinsEmptyState>
        ) : rows.length === 0 ? (
          <JenkinsEmptyState>没有匹配的任务</JenkinsEmptyState>
        ) : (
          <VirtualList
            items={rows}
            estimateSize={48}
            overscan={12}
            dynamicSize
            handleRef={listHandleRef}
            containerClassName="h-full"
            renderItem={(row, index) => (
              <JobTreeNode
                job={row.job}
                depth={row.depth}
                isFolder={row.isFolder}
                isExpanded={row.isExpanded}
                activity={jobActivity?.get(row.job.url)}
                index={index}
                onToggle={onToggle}
                onBuild={onBuild}
                onDetails={onDetails}
                availableTags={tags}
              />
            )}
          />
        )}
      </div>
    </JenkinsPanel>
  );
}
