import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { groupSessionsByUpdatedAt } from '../src/features/aiAssistant/components/aiSessionTimeline.ts';
import { planEmptySessionCleanup } from '../src/features/aiAssistant/hooks/useAIChatSessions.shared.ts';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

const sessions = [
  { id: 'latest', title: '新会话', createdAt: 3, updatedAt: 3 },
  { id: 'old-empty', title: '新会话', createdAt: 2, updatedAt: 2 },
  { id: 'with-content', title: '已有内容', createdAt: 1, updatedAt: 1 },
];

test('reuses only the latest empty session and removes stale empty sessions', () => {
  assert.deepEqual(planEmptySessionCleanup(sessions, new Set(['latest', 'old-empty'])), {
    reusableSession: sessions[0],
    staleSessionIds: ['old-empty'],
  });

  assert.deepEqual(planEmptySessionCleanup(sessions, new Set(['old-empty'])), {
    reusableSession: null,
    staleSessionIds: ['old-empty'],
  });
});

test('groups sessions by updated time and keeps latest activity first', () => {
  const now = new Date(2026, 8, 5, 12).getTime();
  const grouped = groupSessionsByUpdatedAt(
    [
      { id: 'week', title: '本周', createdAt: 1, updatedAt: new Date(2026, 8, 1, 9).getTime() },
      {
        id: 'today-old',
        title: '今天早些',
        createdAt: 2,
        updatedAt: new Date(2026, 8, 5, 8).getTime(),
      },
      {
        id: 'yesterday',
        title: '昨天',
        createdAt: 3,
        updatedAt: new Date(2026, 8, 4, 18).getTime(),
      },
      {
        id: 'today-new',
        title: '今天最近',
        createdAt: 4,
        updatedAt: new Date(2026, 8, 5, 11).getTime(),
      },
    ],
    now
  );

  assert.deepEqual(
    grouped.map((group) => [group.label, group.sessions.map((session) => session.id)]),
    [
      ['今天', ['today-new', 'today-old']],
      ['昨天', ['yesterday']],
      ['近 7 天', ['week']],
    ]
  );
});

test('groups pinned sessions before date groups and orders them by pin time', () => {
  const now = new Date(2026, 8, 5, 12).getTime();
  const grouped = groupSessionsByUpdatedAt(
    [
      {
        id: 'today',
        title: '今天',
        createdAt: 1,
        updatedAt: new Date(2026, 8, 5, 10).getTime(),
      },
      {
        id: 'pinned-old',
        title: '旧置顶',
        createdAt: 2,
        updatedAt: new Date(2026, 8, 1).getTime(),
        pinnedAt: 4,
      },
      {
        id: 'pinned-new',
        title: '新置顶',
        createdAt: 3,
        updatedAt: new Date(2026, 8, 2).getTime(),
        pinnedAt: 5,
      },
    ],
    now
  );

  assert.deepEqual(
    grouped.map((group) => [group.label, group.sessions.map((session) => session.id)]),
    [
      ['已置顶', ['pinned-new', 'pinned-old']],
      ['今天', ['today']],
    ]
  );
});

test('AI session sidebar exposes matching collapse and expand controls', () => {
  const view = source('../src/features/aiAssistant/components/AIAssistantView.tsx');

  assert.match(view, /onChange=\{handleSidebarSizeChange\}/);
  assert.match(view, /style=\{\{ left: sidebarCollapsed \? 0 : sidebarWidth \}\}/);
  assert.match(view, /sidebarCollapsed \? '展开会话侧栏' : '折叠会话侧栏'/);
  assert.match(view, /h-10 w-5/);
  assert.match(view, /<PanelLeftOpen className="h-3 w-3"/);
});

test('AI session rows expose immediate metadata on hover and focus', () => {
  const list = source('../src/features/aiAssistant/components/AISessionList.tsx');

  assert.match(list, /role="tooltip"/);
  assert.match(list, /className="[^"]*fixed/);
  assert.match(list, /HighlightedText/);
  assert.match(list, /currentMessageSearchMatches\[session\.id\]/);
  assert.match(list, /未找到会话/);
  assert.match(list, /getBoundingClientRect/);
  assert.match(list, /rect\.right \+ 8/);
  assert.match(list, /isHovered \? 'z-20 border-primary bg-accent ring-1 ring-primary\/30'/);
  assert.match(list, /before:left-\[-5px\]/);
  assert.match(list, /session\.role\?\.title \?\? 'AI 助手'/);
  assert.match(list, /DETAIL_TIME_FORMATTER\.format\(session\.createdAt\)/);
  assert.match(list, /DETAIL_TIME_FORMATTER\.format\(session\.updatedAt\)/);
});

test('AI session search includes message content', () => {
  const queries = source('../src/lib/db/aiQueries.ts');
  const exports = source('../src/lib/db/ai.ts');
  const sidebar = source('../src/features/aiAssistant/components/AIAssistantSidebar.tsx');

  assert.match(queries, /searchSessionMessages/);
  assert.match(queries, /message\.content\.toLocaleLowerCase\(\)/);
  assert.match(queries, /message\.content\.slice\(range\.start, range\.end\)/);
  assert.match(queries, /ranges: Array<\{ start: number; end: number \}>/);
  assert.match(queries, /previousRange\.end \+ 16/);
  assert.match(queries, /sessionMatches\.includes\(snippet\)/);
  assert.match(queries, /sessionMatches\.push/);
  assert.match(queries, /sessionMatches\.length >= 8/);
  assert.match(exports, /searchSessionMessages/);
  assert.match(sidebar, /搜索标题、角色或内容/);
  assert.match(sidebar, /searchQuery=\{sessionSearchQuery\}/);
  assert.match(sidebar, /<Dialog open=\{sessionSearchOpen\}/);
  assert.match(sidebar, /<DialogContent className="flex h-\[75vh\]/);
  assert.match(sidebar, /searchOnly=\{true\}/);
  assert.match(sidebar, /onSelectSession=\{selectSession\}/);
});

test('removed cyber foreman sessions fall back to the default role', () => {
  const roleRuntime = source('../src/features/aiAssistant/roles/roleRuntime.ts');
  const roleSelector = source('../src/features/aiAssistant/components/AIRoleSelector.tsx');
  const sessions = source('../src/features/aiAssistant/hooks/useAIChatSessions.ts');
  const runtime = source('../src/features/aiAssistant/hooks/useAIChatRuntime.ts');

  assert.doesNotMatch(roleRuntime, /CYBER_FOREMAN_ROLE_ID/);
  assert.doesNotMatch(roleRuntime, /赛博包工头/);
  assert.doesNotMatch(roleSelector, /赛博包工头/);
  assert.match(sessions, /storedRole\.roleId === 'builtin:cyber-foreman'/);
  assert.match(sessions, /createBuiltInRoleSnapshot\(roleId\)/);
  assert.match(runtime, /isDppBuiltInRole\(role\.roleId\)/);
});

test('selected role persists and becomes the role for new empty sessions', () => {
  const sessions = source('../src/features/aiAssistant/hooks/useAIChatSessions.ts');

  assert.match(sessions, /browser\.storage\.local\.get\(PREFERRED_AI_ROLE_STORAGE_KEY\)/);
  assert.match(
    sessions,
    /browser\.storage\.local\.set\(\{ \[PREFERRED_AI_ROLE_STORAGE_KEY\]: roleId \}\)/
  );
  assert.match(sessions, /createSession\('新会话', preferredRole\)/);
  assert.match(sessions, /updateSessionRole\(reusableSession\.id, preferredRole\)/);
  assert.match(sessions, /browser\.storage\.local\.remove\(PREFERRED_AI_ROLE_STORAGE_KEY\)/);
});

test('automatic session titles use the first user message', () => {
  const actions = source('../src/features/aiAssistant/hooks/useAIChatActions.ts');

  assert.match(actions, /const userMessages = messagesRef\.current\.filter/);
  assert.match(actions, /userMessages\.length > 0/);
  assert.match(actions, /generateSessionTitle\(userMessages\[0\]\.content\)/);
});

test('mounted sidebars react to imported sessions through extension session storage', () => {
  const sessions = source('../src/features/aiAssistant/hooks/useAIChatSessions.ts');
  const shared = source('../src/features/aiAssistant/hooks/useAIChatSessions.shared.ts');
  const view = source('../src/features/aiAssistant/components/AIAssistantView.tsx');

  assert.match(sessions, /browser\.storage\.session\.onChanged\.addListener/);
  assert.match(sessions, /await loadSession\(importedSessionId\)/);
  assert.match(view, /browser\.storage\.session\.onChanged\.addListener/);
  assert.match(view, /AI_CURRENT_SESSION_STORAGE_KEY/);
  assert.doesNotMatch(shared, /sessionStorage\.setItem/);
});

test('role editing separates updates from derived roles and removes deletion', () => {
  const selector = source('../src/features/aiAssistant/components/AIRoleSelector.tsx');
  const roles = source('../src/lib/db/roles.ts');

  assert.match(selector, /派生新角色/);
  assert.doesNotMatch(selector, /deleteRoleMaterial/);
  assert.match(roles, /deriveRoleMaterial/);
  assert.match(roles, /derivedFrom: \{ roleId: source\.id, version: source\.version \}/);
  assert.match(selector, /updateRoleMaterial\(role\.id, input, role\.version\)/);
  assert.match(roles, /expectedVersion: number/);
  assert.match(roles, /current\.version !== expectedVersion/);
});

test('role usage is recorded from real user messages and deduplicated per session', () => {
  const persistence = source('../src/features/aiAssistant/services/aiChatPersistence.ts');
  const usage = source('../src/lib/db/roleUsage.ts');

  assert.match(persistence, /recordRoleUsageForSession\(sessionId\)/);
  assert.match(usage, /const eventId = `\$\{sessionId\}:\$\{roleId\}`/);
  assert.match(usage, /if \(existing\) return/);
});

test('role selector keeps D zai first and supports role search and sorting', () => {
  const selector = source('../src/features/aiAssistant/components/AIRoleSelector.tsx');

  assert.match(selector, /type RoleSortOption = 'updatedAt' \| 'usageRate'/);
  assert.match(selector, /role\.title\.toLocaleLowerCase\(\)\.includes\(query\)/);
  assert.match(selector, /usageStats\?\.\[right\.id\]\?\.rate/);
  assert.match(selector, /right\.updatedAt - left\.updatedAt/);
  assert.doesNotMatch(selector, /usageCount|localeCompare\(right\.title/);
  assert.ok(selector.indexOf('title="D 仔"') < selector.indexOf('visibleRoles.map'));
});
