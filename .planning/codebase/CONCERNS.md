# Codebase Concerns

**Analysis Date:** 2026-03-27

## Tech Debt

**MutationObserver Memory Leaks in Content Scripts:**
- Issue: MutationObservers are created but never disconnected when pages navigate away
- Files: `src/entrypoints/zentao.content.tsx` (lines 83-87, 244-252, 571-574), `src/entrypoints/recorder.content.ts`
- Impact: Memory grows over time as content scripts accumulate observers
- Fix approach: Store observer references and call `observer.disconnect()` on cleanup events or when script unloads

**setTimeout Accumulation in Content Scripts:**
- Issue: Multiple setTimeout intervals are scheduled for retry patterns but never cleared when injection succeeds
- Files: `src/entrypoints/zentao.content.tsx` (lines 77-80, 236-242, 566-569)
- Impact: Timers continue firing even after injection is complete
- Fix approach: Track timer IDs and clear them after successful injection

**setInterval Without Cleanup:**
- Issue: Some setInterval timers are not cleared on component unmount
- Files: `src/components/Tips.tsx` (line 28), `src/hooks/useGlobalSync.ts` (lines 67, 79)
- Impact: Timer callbacks may fire after component is unmounted
- Fix approach: Return cleanup functions from hooks that clear intervals

**Iframe Event Listeners Not Removed:**
- Issue: `iframe.addEventListener('load', ...)` is never removed
- Files: `src/entrypoints/zentao.content.tsx` (line 553)
- Impact: Listeners accumulate if iframes reload
- Fix approach: Store listener references and remove them appropriately

## Known Issues

**Silent Null Returns Masking Errors:**
- Issue: Many functions return `null` or `[]` on error instead of throwing, making debugging difficult
- Files: Multiple files including `src/lib/db/links.ts`, `src/lib/db/tags.ts`, `src/features/jenkins/api/client.ts`
- Impact: Errors are silently swallowed, making it hard to diagnose failures
- Fix approach: Consider using a Result/Either type pattern or logging errors before returning null

**Jenkins API Client Returns Null on HTTP Errors:**
- Issue: `fetchApi()` returns `null` instead of throwing when HTTP requests fail
- Files: `src/features/jenkins/api/client.ts` (line 43)
- Impact: Calling code cannot distinguish between network errors, timeouts, and non-2xx responses
- Fix approach: Throw typed errors that callers can handle appropriately

## Security Considerations

**Network Interceptor Captures All Headers:**
- Issue: The network interceptor no longer redacts sensitive headers (auth tokens, cookies)
- Files: `src/entrypoints/network-interceptor.ts` (lines 30-38 comment shows SENSITIVE_HEADERS was disabled)
- Current mitigation: Headers are captured but only for local recording playback
- Recommendations: Consider re-adding header redaction for production builds, or add a privacy mode

**Sensitive Data in IndexedDB:**
- Risk: Jenkins credentials are stored encrypted, but sync access tokens are stored in settings
- Files: `src/db/index.ts`, `src/db/types.ts`
- Current mitigation: Encryption key is derived from user password; sync uses E2EE
- Recommendations: Ensure key derivation uses adequate work factors (PBKDF2/Argon2)

**Jenkins Credentials Transmitted:**
- Risk: Jenkins credentials are sent to Jenkins servers (required for API access)
- Files: `src/features/jenkins/api/client.ts`
- Recommendations: Use token-based auth instead of username/password where possible

## Performance Bottlenecks

**Large Vendor Bundle (rrweb):**
- Problem: `src/vendor/rrweb/rrweb.js` is 28,293 lines
- Impact: Increases extension bundle size significantly
- Cause: Bundled rrweb library for session recording
- Improvement path: Consider tree-shaking or using only needed rrweb plugins

**Large AI Chat Hook:**
- Problem: `src/features/aiAssistant/hooks/useAIChat.ts` is 1,118 lines
- Impact: Initial load time for AI Assistant feature
- Cause: Complex conversation management logic with streaming, tool calls, and session handling
- Improvement path: Consider splitting into smaller hooks (useStreaming, useToolCalls, useSessions)

**Network Interceptor Complexity:**
- Problem: `src/entrypoints/network-interceptor.ts` is 962 lines
- Impact: Bundle size and parse time for content script
- Cause: Comprehensive fetch/XHR/EventSource interception
- Improvement path: Consider splitting into separate modules per protocol

**Sync Engine Complexity:**
- Problem: `src/lib/sync/SyncEngine.ts` is 896 lines
- Impact: Hard to maintain and test
- Cause: Handles hooks, retry logic, conflict resolution, event emitters
- Improvement path: Extract conflict resolution and retry logic into separate classes

**ArrayBuffer Cloning in Network Interceptor:**
- Problem: Full ArrayBuffer data is cloned for every network response
- Files: `src/entrypoints/network-interceptor.ts` (line 292)
- Impact: Memory pressure for large responses
- Cause: Capturing full response data for replay
- Improvement path: Store reference instead of cloning, or limit size

## Fragile Areas

**Sync LWW Conflict Resolution:**
- Files: `src/lib/sync/SyncEngine.ts`, `src/lib/sync/types.ts`
- Why fragile: LWW strategy means last write always wins - no merge capability. If clocks are unsynchronized, data can be lost silently.
- Safe modification: When changing LWW logic, update BOTH the type definitions AND the conflict resolution in SyncEngine.ts
- Test coverage: Manual testing only

**Dexie Hook Transaction Source Checks:**
- Files: `src/lib/sync/SyncEngine.ts` (multiple hook implementations)
- Why fragile: All hooks check `tx.source === 'sync'` to prevent infinite loops. If this check is accidentally removed, sync will recurse infinitely.
- Safe modification: Always verify `tx.source === 'sync'` is present when adding new hooks
- Test coverage: Manual testing only

**Deep Clone in Console Interceptor:**
- Files: `src/entrypoints/console-interceptor.ts` (lines 41-384)
- Why fragile: 343-line deep clone function handles many edge cases. Adding new type handling requires understanding the full scope.
- Safe modification: Test with circular references, Proxies, and detached DOM nodes
- Test coverage: Manual testing only

## Scaling Limits

**IndexedDB Storage:**
- Current capacity: Browser-dependent, typically 50MB-无限制 for extensions
- Limit: No automatic cleanup of old recordings or operations
- Scaling path: Implement storage usage monitoring and cleanup policies

**Sync Operation Queue:**
- Current capacity: Operations table grows indefinitely
- Limit: No upper bound on pending operations
- Scaling path: Implement operation archival or compaction after successful sync

**Hot News Cache:**
- Current capacity: 3 days of news cached
- Limit: Fixed at 3 dates
- Scaling path: Configurable retention period

## Dependencies at Risk

**rrweb (Alpha Version):**
- Risk: Using `rrweb@2.0.0-alpha.20` - alpha versions may have breaking changes
- Impact: Session recording and replay could break on updates
- Migration plan: Wait for stable release, or pin to specific commit

**WXT Framework:**
- Risk: WXT is relatively new and may have breaking changes between minor versions
- Impact: Extension may break on framework updates
- Migration plan: Pin WXT version and review changelog before updating

## Missing Critical Features

**Automated Testing:**
- What's missing: No unit tests or integration tests in `src/`
- Blocks: Refactoring confidence, regression detection
- Priority: High

**Error Boundaries for Individual Features:**
- What's missing: Single global ErrorBoundary, no per-feature boundaries
- Blocks: One feature error crashes entire side panel
- Priority: Medium

**Storage Usage Monitoring:**
- What's missing: No visibility into IndexedDB usage
- Blocks: Users don't know when storage is running low
- Priority: Low

## Test Coverage Gaps

**Untested Areas:**
- Sync conflict resolution - LWW logic has no automated tests
- Dexie hook interactions - sync hooks tested manually only
- Network interceptor - tested by recording real sessions
- Console interceptor deep clone - edge cases tested manually
- AI provider streaming - tested manually with live API calls

**Files needing tests:**
- `src/lib/sync/SyncEngine.ts` - conflict resolution
- `src/lib/db/links.ts` - CRUD operations
- `src/lib/db/tags.ts` - CRUD operations
- `src/entrypoints/network-interceptor.ts` - interceptor logic
- `src/entrypoints/console-interceptor.ts` - deep clone logic

---

*Concerns audit: 2026-03-27*
