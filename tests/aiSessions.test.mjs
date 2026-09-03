import assert from 'node:assert/strict';
import test from 'node:test';
import { planEmptySessionCleanup } from '../src/features/aiAssistant/hooks/useAIChatSessions.shared.ts';

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
