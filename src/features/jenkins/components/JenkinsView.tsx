import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronDown, ChevronRight, History, RefreshCw, User, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { JENKINS } from '@/config/constants';
import { db } from '@/db';
import { BuildDialog } from '@/features/jenkins/components/BuildDialog';
import { JobRow } from '@/features/jenkins/components/JobRow';
import { JobTreeNode } from '@/features/jenkins/components/JobTreeNode';
import { MyBuildRow } from '@/features/jenkins/components/MyBuildRow';
import { RefreshCountdown } from '@/features/jenkins/components/RefreshCountdown';
import { JenkinsService } from '@/features/jenkins/service';
import { buildJobTree } from '@/features/jenkins/utils';
import { logger } from '@/utils/logger';

export function JenkinsView() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [expandedUrls, setExpandedUrls] = useState<Set<string>>(new Set());
  const [buildJob, setBuildJob] = useState<{ url: string; name: string } | null>(null);

  const [myBuildsLoading, setMyBuildsLoading] = useState(false);
  const [nextRefreshTime, setNextRefreshTime] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const settings = useLiveQuery(() => db.settings.toArray()) || [];

  const showOthersBuilds =
    (settings.find((s) => s.key === 'show_others_builds')?.value as boolean) ?? false;

  const { jobs, jobTags, tags } = useLiveQuery(
    async () => {
      const [allJobs, allJobTags, allTags] = await Promise.all([
        db.jobs.toArray(),
        db.jobTags.filter((jt) => !jt.deletedAt).toArray(),
        db.tags.filter((t) => !t.deletedAt).toArray(),
      ]);
      return {
        jobs: allJobs.sort((a, b) => a.name.localeCompare(b.name)),
        jobTags: allJobTags,
        tags: allTags,
      };
    },
    [refreshKey],
    { jobs: [], jobTags: [], tags: [] }
  );

  const myBuilds =
    useLiveQuery(() => db.myBuilds.orderBy('timestamp').reverse().toArray(), [refreshKey]) || [];

  const othersBuilds =
    useLiveQuery(() => db.othersBuilds.orderBy('timestamp').reverse().toArray(), [refreshKey]) ||
    [];

  const displayedBuilds = useMemo(() => {
    let builds = [...myBuilds];
    if (showOthersBuilds) {
      builds = [...builds, ...othersBuilds];
    }
    return builds.sort((a, b) => b.timestamp - a.timestamp).slice(0, 50); // Limit total display
  }, [myBuilds, othersBuilds, showOthersBuilds]);

  const filteredJobs = useMemo(() => {
    if (!jobs || jobs.length === 0) return [];
    if (!filter) return jobs;

    const keywords = filter.toLowerCase().split(' ').filter(Boolean);
    if (keywords.length === 0) return jobs;

    return jobs.filter((j) => {
      const name = j.name.toLowerCase();
      const fullName = (j.fullName || j.name).toLowerCase();

      const jobTagIds = jobTags.filter((jt) => jt.jobUrl === j.url).map((jt) => jt.tagId);
      const jobTagNames = tags
        .filter((t) => t.id && jobTagIds.includes(t.id))
        .map((t) => t.name.toLowerCase());

      return keywords.every(
        (kw) =>
          name.includes(kw) ||
          fullName.includes(kw) ||
          jobTagNames.some((tagName) => tagName.includes(kw))
      );
    });
  }, [jobs, jobTags, tags, filter]);

  const jobTree = useMemo(() => {
    if (filter || !jobs) return [];
    return buildJobTree(jobs);
  }, [jobs, filter]);

  const jenkinsHost = settings.find((s) => s.key === 'jenkins_host')?.value as string;
  const jenkinsUser = settings.find((s) => s.key === 'jenkins_user')?.value as string;
  const jenkinsToken = settings.find((s) => s.key === 'jenkins_token')?.value as string;

  useEffect(() => {
    if (!jenkinsHost || !jenkinsUser || !jenkinsToken) return;

    let mounted = true;
    let timeoutId: NodeJS.Timeout;

    const poll = async () => {
      try {
        setMyBuildsLoading(true);
        await JenkinsService.fetchMyBuilds();
        setMyBuildsLoading(false);
        setRefreshKey((prev) => prev + 1);
        setRefreshKey((prev) => prev + 1);
        setNextRefreshTime(Date.now() + JENKINS.POLL_INTERVAL_MS);
      } catch (e) {
        logger.error('Auto-refresh My Builds failed', e);
        setMyBuildsLoading(false);
      } finally {
        if (mounted) {
          timeoutId = setTimeout(poll, JENKINS.POLL_INTERVAL_MS);
        }
      }
    };

    poll();

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  }, [jenkinsHost, jenkinsUser, jenkinsToken]);

  const handleSync = async () => {
    if (!jenkinsHost || !jenkinsUser || !jenkinsToken) {
      toast('请先在设置中配置 Jenkins', 'error');
      return;
    }
    setLoading(true);
    try {
      const jobCount = await JenkinsService.fetchAllJobs();
      setRefreshKey((prev) => prev + 1);
      toast(`采集完成，Job: ${jobCount}`, 'success');
    } catch (e) {
      logger.error('Sync failed', e);
      toast('采集失败，请检查控制台', 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleShowOthers = async (checked: boolean) => {
    await db.settings.put({ key: 'show_others_builds', value: checked });
  };

  const toggleExpand = (url: string) => {
    const next = new Set(expandedUrls);
    if (next.has(url)) next.delete(url);
    else next.add(url);
    setExpandedUrls(next);
  };

  if (!jenkinsToken) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <p className="text-muted-foreground">请先在设置页配置 Jenkins</p>
        <Button
          variant="outline"
          onClick={() => browser.tabs.create({ url: browser.runtime.getURL('/options.html') })}
        >
          去设置
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="搜索 Job..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="flex-1"
        />
        <Button onClick={handleSync} disabled={loading} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? '采集中...' : '采集'}
        </Button>
      </div>

      <div className="flex-1 overflow-auto border rounded-md">
        {!jobs || jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            {loading ? '正在从 Jenkins 获取数据...' : '暂无数据，请点击采集'}
          </div>
        ) : filter ? (
          <div className="divide-y">
            {filteredJobs?.map((job) => (
              <JobRow
                key={job.url}
                job={job}
                onBuild={() => setBuildJob({ url: job.url, name: job.name })}
                availableTags={tags}
              />
            ))}
          </div>
        ) : (
          <div className="p-2">
            {/* Build History Section */}
            <div className="mb-2">
              <div
                className="flex items-center gap-2 p-1.5 rounded hover:bg-accent/50 cursor-pointer select-none group"
                onClick={() => toggleExpand('__build_history__')}
                onKeyDown={(e) => e.key === 'Enter' && toggleExpand('__build_history__')}
                role="button"
                tabIndex={0}
              >
                <button
                  type="button"
                  className="p-0.5 rounded hover:bg-muted text-muted-foreground bg-transparent border-0"
                >
                  {expandedUrls.has('__build_history__') ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
                <div className="shrink-0 text-primary relative">
                  <History className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium">构建历史</span>
                <div
                  className="flex items-center gap-1.5 ml-4"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                  role="presentation"
                >
                  <Checkbox
                    id="show-others-inline"
                    checked={showOthersBuilds}
                    onCheckedChange={(checked) => toggleShowOthers(checked as boolean)}
                    className="h-3.5 w-3.5"
                  />
                  <Label
                    htmlFor="show-others-inline"
                    className="text-xs text-muted-foreground cursor-pointer font-normal"
                  >
                    显示他人
                  </Label>
                </div>
                <div className="flex-1" />
                {myBuildsLoading ? (
                  <span className="text-xs text-muted-foreground mr-2 animate-pulse">
                    刷新中...
                  </span>
                ) : (
                  <div className="flex items-center gap-2 mr-2">
                    {nextRefreshTime && <RefreshCountdown targetTime={nextRefreshTime} />}
                    <span className="text-xs text-muted-foreground bg-muted px-1.5 rounded-full">
                      {displayedBuilds.length}
                    </span>
                  </div>
                )}
              </div>
              {expandedUrls.has('__build_history__') && (
                <div className="pl-6 space-y-1">
                  {displayedBuilds.length === 0 ? (
                    <div className="p-2 text-xs text-muted-foreground">暂无构建记录</div>
                  ) : (
                    displayedBuilds.map((build) => (
                      <MyBuildRow
                        key={build.id}
                        build={build}
                        onBuild={() => setBuildJob({ url: build.jobUrl, name: build.jobName })}
                      />
                    ))
                  )}
                </div>
              )}
            </div>

            {jobTree.map((node) => (
              <JobTreeNode
                key={node.job.url}
                node={node}
                expandedUrls={expandedUrls}
                onToggle={toggleExpand}
                onBuild={(job) => setBuildJob({ url: job.url, name: job.name })}
              />
            ))}
          </div>
        )}
      </div>

      {buildJob && (
        <BuildDialog
          isOpen={!!buildJob}
          jobUrl={buildJob.url}
          jobName={buildJob.name}
          onClose={() => setBuildJob(null)}
        />
      )}
    </div>
  );
}
