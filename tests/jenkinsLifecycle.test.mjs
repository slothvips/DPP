import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('Jenkins lifecycle keeps accepted and unknown trigger outcomes distinct', () => {
  const build = source('src/features/jenkins/api/build.ts');
  const messages = source('src/features/jenkins/messages.ts');
  const handler = source('src/entrypoints/background/handlers/jenkins.ts');

  assert.match(build, /status: 'unknown'/);
  assert.match(build, /queueMatch.*queue/);
  assert.match(messages, /JenkinsTriggerResult/);
  assert.match(handler, /createJenkinsBuildOperation/);
  assert.match(handler, /saveJenkinsQueueItem/);
  assert.match(handler, /status: unknownOutcome \? 'unknown' : 'failed'/);
});

test('queue lifecycle exposes query, cancellation, and separate running-build stop', () => {
  const queue = source('src/features/jenkins/api/queue.ts');
  const messages = source('src/features/jenkins/messages.ts');
  const router = source('src/entrypoints/background/backgroundMessageRouter.ts');

  assert.match(queue, /queue\/item\/\$\{queueId\}/);
  assert.match(queue, /queue\/cancelItem\?id=/);
  assert.match(messages, /JENKINS_CANCEL_QUEUE_ITEM/);
  assert.match(messages, /JENKINS_STOP_BUILD/);
  assert.match(router, /JENKINS_GET_QUEUE_ITEM/);
  assert.match(router, /JENKINS_STOP_BUILD/);
  assert.match(source('src/features/jenkins/components/JenkinsQueueSection.tsx'), /getQueueItem/);
  assert.match(source('src/features/jenkins/components/JenkinsQueueSection.tsx'), /取消排队/);
});

test('build details expose test and artifact metadata to the workbench', () => {
  const client = source('src/features/jenkins/api/client.ts');
  const details = source('src/features/jenkins/api/buildDetails.ts');
  const messages = source('src/features/jenkins/messages.ts');
  const dialog = source('src/features/jenkins/components/JenkinsBuildDetailsDialog.tsx');

  assert.match(details, /test_report_status/);
  assert.match(details, /details\.building \? \('pending' as const\) : \('missing' as const\)/);
  assert.match(messages, /JENKINS_GET_BUILD_DETAILS/);
  assert.match(dialog, /测试汇总/);
  assert.match(dialog, /当前账号无权读取测试报告/);
  assert.match(dialog, /details\.build\.artifacts/);
  assert.match(client, /maxResponseBytes/);
  assert.match(details, /MAX_FAILED_TESTS/);
  assert.match(details, /redactSensitiveText\(testCase\.errorStackTrace\)/);
  assert.match(messages, /JENKINS_GET_TEST_DETAILS/);
  assert.match(dialog, /getTestDetails/);
});

test('progressive logs are bounded, virtualized, pausable, and redactable', () => {
  const api = source('src/features/jenkins/api/buildDetails.ts');
  const dialog = source('src/features/jenkins/components/JenkinsBuildLogDialog.tsx');

  assert.match(api, /nextStart <= start/);
  assert.match(dialog, /MAX_LOG_BYTES/);
  assert.match(dialog, /VirtualList/);
  assert.match(dialog, /setPaused/);
  assert.match(dialog, /redactSensitiveText/);
  assert.match(dialog, /下载当前视图/);
});

test('artifact downloads are environment-scoped and bounded', () => {
  const api = source('src/features/jenkins/api/artifacts.ts');
  const messages = source('src/features/jenkins/messages.ts');
  const dialog = source('src/features/jenkins/components/JenkinsBuildDetailsDialog.tsx');

  assert.match(api, /MAX_ARTIFACT_BYTES/);
  assert.match(api, /createJenkinsArtifactUrl/);
  assert.match(api, /redirect: 'manual'/);
  assert.match(api, /reader\.cancel/);
  assert.match(messages, /JENKINS_DOWNLOAD_ARTIFACT/);
  assert.match(dialog, /downloadArtifact/);
});

test('Pipeline stages expose capability-aware degradation and persist a snapshot', () => {
  const api = source('src/features/jenkins/api/pipeline.ts');
  const mutations = source('src/lib/db/jenkinsMutations.ts');
  const messages = source('src/features/jenkins/messages.ts');
  const dialog = source('src/features/jenkins/components/JenkinsBuildDetailsDialog.tsx');

  assert.match(api, /wfapi\/describe/);
  assert.match(api, /capability: 'missing'/);
  assert.match(api, /capability: 'permission'/);
  assert.match(api, /MAX_PIPELINE_RESPONSE_BYTES/);
  assert.match(mutations, /saveJenkinsPipelineCapability/);
  assert.match(
    source('src/entrypoints/background/handlers/jenkins.ts'),
    /result\.capability === 'missing' \? 'unknown'/
  );
  assert.match(messages, /JENKINS_GET_PIPELINE_STAGES/);
  assert.match(dialog, /Pipeline 阶段/);
  assert.match(dialog, /pipeline\?\.reason/);
  assert.match(api, /execution\/node\/\$\{encodeURIComponent\(nodeId\)\}\/wfapi/);
  assert.match(api, /getPipelineStageNodes/);
  assert.match(api, /getPipelineNodeLog/);
  assert.match(dialog, /getPipelineNodeLog/);
  assert.match(dialog, /VirtualList/);
  assert.match(dialog, /setRedactNodeLog/);
  assert.match(dialog, /stageRequestIdRef/);
});

test('Pipeline pending inputs require explicit confirmation and bounded extension-only actions', () => {
  const api = source('src/features/jenkins/api/pipeline.ts');
  const messages = source('src/features/jenkins/messages.ts');
  const service = source('src/features/jenkins/service.ts');
  const handler = source('src/entrypoints/background/handlers/jenkins.ts');
  const router = source('src/entrypoints/background/backgroundMessageRouter.ts');
  const authorization = source('src/entrypoints/background/messageAuthorization.ts');
  const dialog = source('src/features/jenkins/components/JenkinsBuildDetailsDialog.tsx');

  assert.match(api, /wfapi\/pendingInputActions/);
  assert.match(api, /PIPELINE_INPUT_ID_PATTERN/);
  assert.match(api, /decision !== 'proceed' && decision !== 'abort'/);
  assert.match(api, /proceedEmpty/);
  assert.match(api, /action = decision === 'proceed' \? 'proceedEmpty' : 'abort'/);
  assert.match(api, /getCrumb/);
  assert.match(api, /redirect: 'manual'/);
  assert.match(api, /assertJenkinsRedirectAllowed/);
  assert.match(messages, /JENKINS_SUBMIT_PIPELINE_INPUT/);
  assert.match(service, /submitPipelineInput/);
  assert.match(handler, /submitPipelineInput/);
  assert.match(router, /JENKINS_SUBMIT_PIPELINE_INPUT/);
  assert.match(authorization, /JENKINS_SUBMIT_PIPELINE_INPUT/);
  assert.match(dialog, /pendingInputAction/);
  assert.match(dialog, /确认\{pendingInputAction\.decision/);
  assert.match(dialog, /需在 Jenkins 填写参数/);
  assert.match(dialog, /<dt>环境<\/dt>/);
  assert.match(dialog, /<dt>Job<\/dt>/);
  assert.match(dialog, /<dt>Build<\/dt>/);
});

test('Jenkins workbench separates run, job, and queue views', () => {
  const view = source('src/features/jenkins/components/JenkinsView.tsx');
  const queue = source('src/features/jenkins/components/JenkinsQueueSection.tsx');

  assert.match(view, /role="tablist"/);
  assert.match(view, /\['run', '运行'\]/);
  assert.match(view, /\['jobs', '任务'\]/);
  assert.match(view, /\['queue', '队列'\]/);
  assert.match(view, /activeView === 'queue'/);
  assert.match(view, /activeView === 'jobs'/);
  assert.match(view, /aria-selected=/);
  assert.match(view, /ArrowLeft/);
  assert.match(view, /ArrowRight/);
  assert.match(view, /tabIndex=\{activeView === value \? 0 : -1\}/);
  assert.match(queue, /当前没有排队中的 Jenkins 构建/);
});

test('Jenkins jobs expose a bounded details drawer and preserve the build entry point', () => {
  const api = source('src/features/jenkins/api/build.ts');
  const dialog = source('src/features/jenkins/components/JenkinsJobDetailsDialog.tsx');
  const content = source('src/features/jenkins/components/JenkinsJobContent.tsx');
  const view = source('src/features/jenkins/components/JenkinsView.tsx');

  assert.match(api, /fetchJson<unknown>\(apiUrl, 512_000\)/);
  assert.match(dialog, /asRecord/);
  assert.match(dialog, /description/);
  assert.match(dialog, /onBuild\(job\)/);
  assert.match(content, /onDetails/);
  assert.match(view, /JenkinsJobDetailsDialog/);
});

test('Jenkins job search and tree reuse one accessible row component', () => {
  const content = source('src/features/jenkins/components/JenkinsJobContent.tsx');
  const row = source('src/features/jenkins/components/JobTreeNode.tsx');

  assert.doesNotMatch(content, /JobRow/);
  assert.match(content, /flattenVisibleNodes/);
  assert.match(content, /VirtualList/);
  assert.match(row, /availableTags=\{availableTags\}/);
  assert.match(row, /aria-expanded=\{isExpanded\}/);
  assert.doesNotMatch(row, /onKeyDown=.*browser\.tabs\.create/);
  assert.doesNotMatch(row, /<button[\s\S]*<JobTagSelector[\s\S]*<\/button>/);
});

test('Jenkins deep links reject unknown environments before mutating settings', () => {
  const deepLink = source('src/features/jenkins/components/useJenkinsDeepLink.ts');

  assert.match(deepLink, /if \(targetEnvId && !targetEnv\)/);
  assert.match(deepLink, /return;/);
  assert.match(deepLink, /targetEnv\.id !== currentEnvId/);
  assert.match(deepLink, /db\.jenkinsJobs[\s\S]*where\('envId'\)[\s\S]*equals\(targetEnv\.id\)/);
  assert.match(deepLink, /unknown or other-environment Job/);
  assert.match(deepLink, /unknown environment/);
  assert.match(deepLink, /onViewChange/);
  assert.match(deepLink, /requestedView === 'queue'/);
});

test('Jenkins capabilities are independently configurable and enforced in the background', () => {
  const flags = source('src/features/jenkins/featureFlags.ts');
  const settings = source('src/db/typesSettings.ts');
  const options = source('src/entrypoints/options/FeatureTogglesSection.tsx');
  const handler = source('src/entrypoints/background/handlers/jenkins.ts');
  const build = source('src/features/jenkins/components/useBuildDialog.ts');
  const env = source('src/features/settings/components/useJenkinsEnvDialog.ts');
  const ai = source('src/lib/ai/tools/jenkins.ts');
  const omnibox = source('src/entrypoints/background/handlers/omniboxActions.ts');
  const assistant = source('src/features/aiAssistant/components/AIAssistantView.tsx');

  for (const key of [
    'jenkins_workbench_v2',
    'jenkins_queue',
    'jenkins_build_lifecycle',
    'jenkins_full_log',
    'jenkins_pipeline_features',
    'jenkins_artifacts',
    'jenkins_ai_actions',
  ]) {
    assert.match(settings, new RegExp(key));
  }
  assert.match(flags, /JENKINS_FEATURE_KEYS/);
  assert.doesNotMatch(options, /jenkins-feature-toggles/);
  assert.match(handler, /isJenkinsFeatureEnabled/);
  assert.match(handler, /requiredFeature/);
  assert.match(handler, /Jenkins 能力已关闭/);
  assert.match(ai, /requireJenkinsFeature\('aiActions'\)/);
  assert.match(omnibox, /isJenkinsFeatureEnabled\('workbench'\)/);
  assert.match(omnibox, /await browser\.windows\.create/);
  assert.match(assistant, /isJenkinsFeatureEnabled\('buildLifecycle'\)/);
  assert.match(assistant, /job\.env !== action\.envId/);
  assert.match(build, /确认触发构建/);
  assert.match(env, /确认添加 Jenkins 环境/);
  assert.match(env, /确认修改 Jenkins 环境/);
});

test('Jenkins refreshes persist bounded, environment-scoped diagnostics', () => {
  const mutations = source('src/lib/db/jenkinsMutations.ts');
  const jobs = source('src/features/jenkins/api/fetchJobs.ts');
  const builds = source('src/features/jenkins/api/fetchMyBuilds.ts');

  assert.match(mutations, /trackJenkinsSync/);
  assert.match(mutations, /status: 'syncing'/);
  assert.match(mutations, /status: error instanceof TypeError \? 'offline' : 'error'/);
  assert.match(mutations, /patch\.status === 'success'.*existing\?\.status === 'error'/s);
  assert.match(mutations, /redactSensitiveText\(patch\.errorMessage\)/);
  assert.match(mutations, /slice\(0, 300\)/);
  assert.match(jobs, /trackJenkinsSync\(envId/);
  assert.match(builds, /trackJenkinsSync\(envId/);
});

test('Jenkins AI lifecycle writes stay behind an unbypassable confirmation gate', () => {
  const jenkins = source('src/lib/ai/tools/jenkins.ts');
  const gate = source('src/features/aiAssistant/lib/toolCallUtils.ts');
  const confirmation = source('src/features/aiAssistant/components/toolConfirmationShared.ts');

  for (const tool of [
    'jenkins_cancel_queue',
    'jenkins_stop_build',
    'jenkins_submit_pipeline_input',
  ]) {
    assert.match(jenkins, new RegExp(`name: '${tool}'`));
    assert.match(gate, new RegExp(tool));
    assert.match(confirmation, new RegExp(`case '${tool}'`));
  }
  assert.match(gate, /jenkins_trigger_build/);
  assert.match(jenkins, /name: 'jenkins_get_status'/);
  assert.match(jenkins, /name: 'jenkins_get_queue_item'/);
  assert.match(jenkins, /JenkinsService\.cancelQueueItem/);
  assert.match(jenkins, /JenkinsService\.stopBuild/);
  assert.match(jenkins, /JenkinsService\.submitPipelineInput/);
});

test('Jenkins metrics and diagnostics stay local, bounded, and redacted', () => {
  const metrics = source('src/features/jenkins/metrics.ts');
  const diagnostics = source('src/features/jenkins/diagnostics.ts');
  const handler = source('src/entrypoints/background/handlers/jenkins.ts');
  const debug = source('src/entrypoints/debug/main.tsx');

  assert.match(metrics, /JenkinsMetricSnapshot/);
  assert.match(metrics, /flushJenkinsMetrics/);
  assert.match(metrics, /byCode/);
  assert.match(handler, /recordJenkinsRequest/);
  assert.match(handler, /recordJenkinsQueue\('poll'\)/);
  assert.match(handler, /recordJenkinsQueue\('cancel'\)/);
  assert.match(handler, /void flushJenkinsMetrics/);
  assert.match(source('src/features/jenkins/api/fetchJobs.ts'), /recordJenkinsCache\('jobs'/);
  assert.match(source('src/features/jenkins/api/buildDetails.ts'), /recordJenkinsLogChunk/);
  assert.match(diagnostics, /找不到指定的 Jenkins 环境/);
  assert.match(diagnostics, /STALE_THRESHOLD_MS/);
  assert.match(debug, /formatDebugMetrics/);
});

test('Jenkins capability snapshot covers version, identity, permissions, and queue', () => {
  const api = source('src/features/jenkins/api/capabilities.ts');
  const mutations = source('src/lib/db/jenkinsMutations.ts');
  const handler = source('src/entrypoints/background/handlers/jenkins.ts');

  assert.match(api, /probeJenkinsCapabilities/);
  assert.match(api, /X-Jenkins/);
  assert.match(api, /me\/api\/json/);
  assert.match(api, /queue\/api\/json/);
  assert.match(api, /crumbIssuer/);
  assert.match(api, /permissions/);
  assert.match(mutations, /saveJenkinsCapabilities/);
  assert.match(handler, /probeJenkinsCapabilities/);
  assert.match(handler, /saveJenkinsCapabilities\(envId/);
});

test('Omnibox resolves Jenkins jobs per environment instead of by URL only', () => {
  const shared = source('src/entrypoints/background/handlers/omniboxShared.ts');
  const search = source('src/entrypoints/background/handlers/omniboxSearch.ts');
  const actions = source('src/entrypoints/background/handlers/omniboxActions.ts');
  const queries = source('src/lib/db/jenkinsQueries.ts');

  assert.match(queries, /getAllScopedJenkinsJobs/);
  assert.match(queries, /db\.jenkinsJobs\.toArray/);
  assert.match(shared, /getAllScopedJenkinsJobs/);
  assert.match(shared, /parseJenkinsJobContent/);
  assert.match(search, /buildJenkinsJobContent/);
  assert.match(actions, /parseJenkinsJobContent/);
  assert.match(actions, /encodeURIComponent\(envId\)/);
});

test('Queue polling records timeout and expiry diagnostics per environment', () => {
  const handler = source('src/entrypoints/background/handlers/jenkins.ts');
  const mutations = source('src/lib/db/jenkinsMutations.ts');
  const diagnostics = source('src/features/jenkins/diagnostics.ts');

  assert.match(mutations, /recordJenkinsQueueState/);
  assert.match(handler, /recordJenkinsQueueState\(envId, \{ timedOut: true \}\)/);
  assert.match(handler, /expired: item\.state === 'expired'/);
  assert.match(diagnostics, /queueState/);
});

test('legacy Jenkins tables are dropped and unreferenced', () => {
  const schema = source('src/db/schema.ts');
  const mutations = source('src/lib/db/jenkinsMutations.ts');
  const data = source('src/features/jenkins/components/useJenkinsViewData.ts');
  const catalog = source('src/lib/db/jobCatalog.ts');
  const queries = source('src/lib/db/jenkinsQueries.ts');

  assert.match(
    schema,
    /db\.version\(28\)\.stores\(\{[\s\S]*jobs: null[\s\S]*myBuilds: null[\s\S]*othersBuilds: null/
  );
  for (const file of [mutations, data, catalog, queries]) {
    assert.doesNotMatch(file, /db\.myBuilds|db\.othersBuilds|db\.jobs\b/);
  }
});

test('Jenkins job catalog is env-scoped and the legacy jobs table is write-retired', () => {
  const mutations = source('src/lib/db/jenkinsMutations.ts');
  const catalog = source('src/lib/db/jobCatalog.ts');
  const tags = source('src/lib/db/tagsQueries.ts');
  const associations = source('src/lib/db/tagsAssociations.ts');
  const search = source('src/lib/ai/tools/dppSearch.ts');

  assert.doesNotMatch(mutations, /db\.jobs\.bulkPut/);
  assert.match(mutations, /db\.jenkinsJobs\.bulkPut/);
  assert.match(catalog, /db\.jenkinsJobs\.where\('url'\)/);
  assert.match(tags, /getJobsByUrls/);
  assert.match(associations, /getJobByUrl/);
  assert.match(search, /getAllScopedJenkinsJobs/);
});

test('Jenkins workbench reads env-scoped tables and shares one request path', () => {
  const data = source('src/features/jenkins/components/useJenkinsViewData.ts');
  const queries = source('src/lib/db/jenkinsQueries.ts');
  const ai = source('src/lib/ai/tools/jenkins.ts');
  const mutations = source('src/lib/db/jenkinsMutations.ts');

  assert.match(data, /db\.jenkinsJobs\.where\('envId'\)/);
  assert.match(data, /db\.jenkinsBuilds\.where\('envId'\)/);
  assert.doesNotMatch(data, /db\.myBuilds/);
  assert.match(queries, /db\.jenkinsJobs\s*\.where\('envId'\)/);
  assert.doesNotMatch(queries, /listBuilds|db\.jenkinsBuilds/);
  assert.match(ai, /JenkinsService\.getBuildDetails/);
  assert.match(ai, /JenkinsService\.fetchJobBuilds/);
  assert.doesNotMatch(ai, /getJenkinsCredentials/);
  assert.match(mutations, /db\.jenkinsBuilds\.bulkPut/);
});

test('Jenkins build cache is bounded and idle polling fetches fewer builds', () => {
  const mutations = source('src/lib/db/jenkinsMutations.ts');
  const builds = source('src/features/jenkins/api/fetchMyBuilds.ts');
  const shared = source('src/features/jenkins/api/fetchMyBuildsShared.ts');
  const polling = source('src/features/jenkins/components/useJenkinsBuildPolling.ts');
  const constants = source('src/config/constants.ts');

  assert.match(mutations, /pruneJenkinsBuilds/);
  assert.match(mutations, /MAX_BUILDS_PER_ENV/);
  assert.match(mutations, /MAX_OTHERS_BUILDS_PER_ENV/);
  assert.match(builds, /pruneJenkinsBuilds\(envId\)/);
  assert.match(shared, /buildMyBuildsTree/);
  assert.match(builds, /buildMyBuildsTree\(maxBuildsPerJob\)/);
  assert.match(polling, /fetchMyBuilds\(JENKINS\.IDLE_BUILDS_PER_JOB\)/);
  assert.match(constants, /IDLE_BUILDS_PER_JOB: 5/);
});

test('Jenkins queue and remote build history are read from the official endpoints', () => {
  const queue = source('src/features/jenkins/api/queue.ts');
  const jobBuilds = source('src/features/jenkins/api/jobBuilds.ts');
  const handler = source('src/entrypoints/background/handlers/jenkins.ts');
  const router = source('src/entrypoints/background/backgroundMessageRouter.ts');
  const auth = source('src/entrypoints/background/messageAuthorization.ts');
  const section = source('src/features/jenkins/components/JenkinsQueueSection.tsx');
  const polling = source('src/features/jenkins/components/useJenkinsBuildPolling.ts');

  assert.match(queue, /export async function listQueue/);
  assert.match(queue, /items\[id,why,blocked/);
  assert.match(jobBuilds, /export async function getJobBuilds/);
  assert.match(jobBuilds, /builds\[number,url,result,timestamp,duration,building/);
  assert.match(handler, /listQueue/);
  assert.match(handler, /getJobBuilds/);
  assert.match(router, /JENKINS_FETCH_QUEUE/);
  assert.match(auth, /JENKINS_FETCH_QUEUE/);
  assert.match(section, /JenkinsService\.fetchQueue/);
  assert.match(polling, /onBuildsChange/);
});

test('Jenkins build polling uses the lightweight active-build path with idle backoff', () => {
  const active = source('src/features/jenkins/api/fetchActiveBuilds.ts');
  const polling = source('src/features/jenkins/components/useJenkinsBuildPolling.ts');
  const constants = source('src/config/constants.ts');
  const handler = source('src/entrypoints/background/handlers/jenkins.ts');
  const router = source('src/entrypoints/background/backgroundMessageRouter.ts');
  const auth = source('src/entrypoints/background/messageAuthorization.ts');

  assert.match(active, /computer\[executors\[currentExecutable\[url\]\]\]/);
  assert.match(active, /MAX_ACTIVE_BUILDS/);
  assert.match(polling, /JenkinsService\.fetchActiveBuilds\(\)/);
  assert.match(polling, /activeCount === 0/);
  assert.match(polling, /FULL_REFRESH_INTERVAL_MS/);
  assert.match(polling, /ACTIVE_POLL_INTERVAL_MS/);
  assert.match(polling, /IDLE_POLL_INTERVAL_MS/);
  assert.match(polling, /getBuildSummary/);
  assert.match(constants, /ACTIVE_POLL_INTERVAL_MS: 3_000/);
  assert.match(constants, /IDLE_POLL_INTERVAL_MS: 15_000/);
  assert.match(constants, /FULL_REFRESH_INTERVAL_MS: 30_000/);
  assert.match(handler, /fetchActiveBuilds/);
  assert.match(handler, /getBuildSummary/);
  assert.match(router, /JENKINS_FETCH_ACTIVE_BUILDS/);
  assert.match(router, /JENKINS_GET_BUILD_STATUS/);
  assert.match(auth, /JENKINS_FETCH_ACTIVE_BUILDS/);
  assert.match(auth, /JENKINS_GET_BUILD_STATUS/);
});

test('Jenkins workbench suspends polling and queries while inactive', () => {
  const dialog = source('src/entrypoints/sidepanel/AIModuleDialog.tsx');
  const hook = source('src/features/jenkins/components/useJenkinsView.ts');
  const data = source('src/features/jenkins/components/useJenkinsViewData.ts');
  const queue = source('src/features/jenkins/components/JenkinsQueueSection.tsx');
  const history = source('src/features/jenkins/components/JenkinsBuildHistorySection.tsx');
  const polling = source('src/features/jenkins/components/useJenkinsBuildPolling.ts');

  assert.match(dialog, /active=\{activeModule === 'jenkins'\}/);
  assert.match(hook, /active && jenkinsFeatureToggles\.workbench/);
  assert.match(data, /if \(!currentEnvId \|\| !active\)/);
  assert.match(queue, /if \(!active \|\| !envId \|\| !localActiveIds\) return/);
  assert.match(queue, /JenkinsService\.fetchQueue/);
  assert.match(history, /VirtualList/);
  assert.match(history, /onRefresh/);
  assert.match(polling, /const refresh = useCallback/);
});

test('Jenkins requests carry the CSRF session cookie and tolerate redirect POSTs', () => {
  for (const file of [
    'src/features/jenkins/api/client.ts',
    'src/features/jenkins/api/build.ts',
    'src/features/jenkins/api/buildDetails.ts',
    'src/features/jenkins/api/queue.ts',
    'src/features/jenkins/api/pipeline.ts',
    'src/features/jenkins/api/artifacts.ts',
    'src/features/jenkins/api/capabilities.ts',
  ]) {
    assert.match(source(file), /credentials: 'include'/, file);
  }
  // Jenkins answers /stop with 302 to the build page.
  assert.match(
    source('src/features/jenkins/api/build.ts'),
    /res\.status >= 200 && res\.status < 400/
  );
});
