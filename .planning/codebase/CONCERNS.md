# Codebase Concerns

**Analysis Date:** 2026-03-27

## Tech Debt

**Sync Engine Complexity:**
- Issue: `src/lib/sync/SyncEngine.ts` (896 lines) handles complex sync logic with LWW conflict resolution, batched operations, and retry logic
- Files: `src/lib/sync/SyncEngine.ts`, `src/lib/sync/types.ts`
- Impact: High risk of sync conflicts being incorrectly resolved; difficult to debug sync issues
- Fix approach: Extract conflict resolution into separate strategy class, add comprehensive logging

**Large AI Chat Hook:**
- Issue: `src/features/aiAssistant/hooks/useAIChat.ts` (1118 lines) handles chat state, tool calls, provider management, and streaming
- Files: `src/features/aiAssistant/hooks/useAIChat.ts`
- Impact: Difficult to test individual features; risk of state management bugs
- Fix approach: Split into smaller hooks (useChatState, useToolCalls, useAIProvider)

**Network Interceptor Fragility:**
- Issue: `src/entrypoints/network-interceptor.ts` (962 lines) overrides global fetch/XHR with extensive try/catch; silent failures throughout
- Files: `src/entrypoints/network-interceptor.ts`, `src/entrypoints/console-interceptor.ts`
- Impact: If interception fails, recording silently breaks without any error feedback; hard to diagnose
- Fix approach: Add global error handler for interceptor failures, expose interceptor health status

**Type Safety Bypasses:**
- Issue: Multiple `as unknown as` and `as any` casts throughout codebase
- Files:
  - `src/entrypoints/player/PlayerApp.tsx` (lines 158, 188, 196)
  - `src/entrypoints/network-interceptor.ts` (line 16, 22, 902, 944, 954)
  - `src/entrypoints/console-interceptor.ts` (line 15, 21, 188, 302, 315, 489)
  - `src/lib/sync/SyncEngine.ts` (line 597)
  - `src/lib/db/tags.ts` (lines 8, 12), `src/lib/db/links.ts` (lines 9)
- Impact: Runtime type errors may go undetected; refactoring risks breaking functionality
- Fix approach: Define proper TypeScript interfaces; eliminate unsafe casts

## Known Bugs

**Potential Sync Race Condition:**
- Symptoms: Occasional sync failures when multiple tabs are open; pending counts may become inconsistent
- Files: `src/lib/globalSync.ts`, `src/hooks/useGlobalSync.ts`
- Trigger: Opening multiple extension sidepanels simultaneously
- Workaround: Close duplicate tabs before syncing

**Content Script Injection Race:**
- Symptoms: Network/console interception may not work on first page load
- Files: `src/entrypoints/network-interceptor.ts`, `src/entrypoints/recorder.content.ts`
- Trigger: Page loads before extension finishes initializing
- Workaround: Refresh page after extension installation

## Security Considerations

**Credentials Stored in IndexedDB:**
- Risk: API keys (AI providers), Jenkins tokens stored in IndexedDB settings table
- Files: `src/lib/db/settings.ts`, `src/db/types.ts`
- Current mitigation: Some keys encrypted via `encryptData`/`decryptData` (AES-GCM)
- Recommendations:
  - All API keys should be encrypted at rest (currently some are plaintext strings)
  - Add key derivation for sync encryption key (PBKDF2 or similar)
  - Implement secure key deletion when user logs out

**Token Exposure in Network Interceptor:**
- Risk: Sensitive headers (Authorization, cookies) captured in network events
- Files: `src/entrypoints/network-interceptor.ts`
- Current mitigation: Commented out SENSITIVE_HEADERS list indicates awareness, but headers are preserved for debugging
- Recommendations: Add option to redact sensitive headers in recordings

**Basic Auth Encoding:**
- Risk: Jenkins credentials encoded as Base64 in Basic Auth header
- Files: `src/features/jenkins/api/client.ts`
- Impact: Credentials visible in network logs if not using HTTPS
- Recommendations: Use token-based auth where possible; warn users about HTTP usage

## Performance Bottlenecks

**Large Link Lists with N+1 Query Pattern:**
- Problem: `listLinks` in `src/lib/db/links.ts` batches data but complex queries may still be slow with thousands of links
- Files: `src/lib/db/links.ts` (525 lines)
- Cause: Dexie filtering + multiple joins for tag resolution
- Improvement path: Add database indexes on frequently queried fields (url, createdAt)

**Tag Resolution in Bulk Operations:**
- Problem: `resolveTagNamesToIds` loads all tags to resolve names
- Files: `src/lib/db/links.ts` (lines 29-50)
- Cause: No indexed lookup by tag name
- Improvement path: Create tag name index in Dexie schema

**Global Sync Periodic Refresh:**
- Problem: `useGlobalSync` sets interval to refresh counts every 30 seconds
- Files: `src/hooks/useGlobalSync.ts` (line 79)
- Cause: Polling instead of event-driven updates
- Improvement path: Use Dexie liveQuery to react to database changes

**Recording Memory Growth:**
- Problem: Network/console interceptors store events in memory during recording
- Files: `src/entrypoints/network-interceptor.ts`, `src/entrypoints/console-interceptor.ts`
- Cause: Unlimited event storage until recording stops
- Improvement path: Implement chunked storage or streaming to disk

## Fragile Areas

**Content Script Injection:**
- Files: `src/entrypoints/recorder.content.ts`, `src/entrypoints/pageAgent.content.ts`
- Why fragile: Relies on `window` object being available; page script may conflict
- Safe modification: Test on multiple websites; ensure idempotent injection guards
- Test coverage: Manual testing only

**Dexie Table Type Casting:**
- Files: `src/lib/db/tags.ts` (lines 8, 12), `src/lib/db/links.ts` (line 9)
- Why fragile: `as unknown as Table<...>` bypasses type safety; compound keys may not work
- Safe modification: Verify Dexie compound key behavior; add runtime validation
- Test coverage: No unit tests

**Legacy Key Migration:**
- Files: `src/lib/crypto/encryption.ts` (lines 104-109)
- Why fragile: Migration from browser.storage.local to IndexedDB happens once; if interrupted, key could be lost
- Safe modification: Add atomic migration with rollback capability
- Test coverage: Not tested

**Sync Lock Mechanism:**
- Files: `src/lib/sync/SyncEngine.ts` (lines 52, 61-63)
- Why fragile: `syncLock` is a simple boolean; crash during sync leaves lock stuck
- Safe modification: Uses 5-minute timeout safety check in `useGlobalSync.ts` (lines 54-71)
- Test coverage: Implicit safety check only

## Scaling Limits

**IndexedDB Storage:**
- Current capacity: Browser-specific limits (typically 50MB-10GB)
- Limit: No cleanup of old recordings; old sync operations accumulate
- Scaling path: Implement recording archival/cleanup; add storage quota monitoring

**Concurrent Sync Operations:**
- Current capacity: Single sync lock prevents concurrent syncs
- Limit: Cannot sync from multiple devices simultaneously without conflict
- Scaling path: Implement proper CRDT-based merge for offline multi-device scenarios

**Large Recording Playback:**
- Current capacity: Entire recording loaded into memory
- Limit: Recordings over 100MB may cause browser crashes
- Scaling path: Implement chunked loading for playback

## Dependencies at Risk

**rrweb Vendor Bundle:**
- Risk: Large bundled vendor code (rrweb.d.ts is 548 lines)
- Impact: If rrweb has security issues, all recorded data is at risk
- Migration plan: Keep rrweb isolated; consider native Recording API alternative

**Dexie Version:**
- Risk: API may change between versions
- Impact: Database schema migrations may break
- Migration plan: Pin dexie version; test migrations thoroughly

## Missing Critical Features

**No Unit/Integration Tests:**
- Problem: Zero project-specific tests; only node_modules test files
- Blocks: Safe refactoring; regression detection; CI/CD quality gates
- Priority: HIGH

**No Error Boundaries:**
- Problem: React component crashes propagate to browser extension context
- Blocks: Stable operation after unexpected errors
- Priority: HIGH

**No Offline Queue Visualization:**
- Problem: Users cannot see pending sync operations count accurately
- Blocks: Trust in sync system; debugging sync issues
- Priority: MEDIUM

## Test Coverage Gaps

**Untested Areas:**
- SyncEngine conflict resolution logic - Files: `src/lib/sync/SyncEngine.ts`
- Database CRUD operations - Files: `src/lib/db/*.ts`
- Content script injection - Files: `src/entrypoints/recorder.content.ts`
- AI provider integration - Files: `src/lib/ai/provider.ts`
- Token encryption/decryption - Files: `src/lib/crypto/encryption.ts`
- Risk: Sync bugs, data corruption, and recording failures go undetected
- Priority: HIGH

---

*Concerns audit: 2026-03-27*
