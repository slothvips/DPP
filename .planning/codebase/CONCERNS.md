# Codebase Concerns

**Analysis Date:** 2026-03-26

## Tech Debt

**Dexie Database Schema with Deprecated Fields:**
- Issue: `LinkItem.category` is marked deprecated but still present in schema
- Files: `src/db/types.ts` line 16
- Impact: Dead code that clutters the schema
- Fix approach: Remove category field after migration path is confirmed

**rrweb Vendor TODO:**
- Issue: `src/vendor/rrweb/rrweb.js:14275` contains TODO about stylesheet snapshot
- Files: `src/vendor/rrweb/rrweb.js`
- Impact: Stylesheet changes during recording may not be captured
- Fix approach: Monitor rrweb upstream for fix or implement stylesheet listener

**Network Interceptor Sensitive Headers Commented:**
- Issue: Sensitive header脱敏代码被注释掉 (`src/entrypoints/network-interceptor.ts:30-38`)
- Files: `src/entrypoints/network-interceptor.ts`
- Impact: Authorization tokens, cookies, API keys may be recorded in plaintext
- Fix approach: Re-enable header sanitization for production, only log full headers in debug mode

**AI Chat Session Compression:**
- Issue: Session compression creates new sessions with "(已压缩)" suffix but has truncation at 2000 chars and limited full dialogue preservation (4000 chars threshold)
- Files: `src/features/aiAssistant/hooks/useAIChat.ts:984-1040`
- Impact: Long conversations lose detail during compression
- Fix approach: Implement smarter summarization that preserves key information

## Known Bugs

**Sync LWW Timestamp Dependency:**
- Issue: Sync engine relies on `updatedAt` field for conflict resolution across all tables, but not all tables consistently set this field
- Files: `src/lib/sync/SyncEngine.ts:565` (getRecordTimestamp check)
- Trigger: Concurrent edits from multiple devices
- Workaround: Manual reconciliation via settings

**Deferred Operations Poison Pill:**
- Issue: If deferred operations fail repeatedly, they are deleted without retry, potentially losing sync data
- Files: `src/lib/sync/SyncEngine.ts:882-884`
- Trigger: Corrupted operation data in deferred_ops table
- Workaround: Clear deferred ops table manually if corrupted

**Page Agent Injection Race Condition:**
- Issue: Page agent injection may fail if page unloads during injection
- Files: `src/entrypoints/background/handlers/pageAgent.ts`
- Trigger: Navigating away quickly after triggering page agent
- Workaround: Retry mechanism exists but may not always recover

## Security Considerations

**API Keys Stored Encrypted But Decryption Falls Back:**
- Issue: In `src/lib/db/settings.ts:76`, if key loading fails, API key falls back to storing plaintext
- Files: `src/lib/db/settings.ts:71-77`, `src/lib/db/settings.ts:91-93`
- Current mitigation: Encryption key required for sync
- Recommendations: Add warning UI when decryption fails, force re-authentication

**Network Interceptor Records Full Headers:**
- Issue: Authorization headers, cookies, and API keys captured in network recordings
- Files: `src/entrypoints/network-interceptor.ts:30-38` (SENSITIVE_HEADERS commented out)
- Current mitigation: Extension-only URLs excluded from recording
- Recommendations: Re-enable header sanitization, add user consent for sensitive data

**Jenkins Token Stored in IndexedDB:**
- Issue: Jenkins API tokens stored with settings (even though encrypted)
- Files: `src/db/types.ts:90` ('jenkins_token' in SettingKey)
- Recommendations: Consider using browser's credential management API

**Sync Access Token Transmitted in Headers:**
- Issue: `X-Access-Token` header sent to sync server on every request
- Files: `src/db/index.ts:114`, `src/db/index.ts:136`, `src/db/index.ts:160`
- Recommendations: Ensure sync server enforces HTTPS

## Performance Bottlenecks

**Large Recording Event Storage:**
- Problem: Network interceptor and console interceptor accumulate large arrays in memory
- Files: `src/entrypoints/network-interceptor.ts:48-49` (STREAM_THROTTLE_MS=100, MAX_STREAM_CHUNKS=1000)
- Cause: No upper bound on total events per recording session
- Improvement path: Implement event eviction or chunking for long recordings

**Links View Full Load Pattern:**
- Problem: `src/features/links/components/LinksView.tsx` loads all links, tags, and stats into memory for filtering
- Files: `src/lib/db/links.ts:81-88` (Promise.all batch loading)
- Cause: No server-side filtering support
- Improvement path: Add IndexedDB indexes for common filter queries

**AI Chat Hook State Updates:**
- Problem: `useAIChat.ts` has complex state management with many `.catch()` handlers that may cause excessive re-renders
- Files: `src/features/aiAssistant/hooks/useAIChat.ts:147` (silent catch), `src/features/aiAssistant/hooks/useAIChat.ts:422`
- Cause: Many fire-and-forget async operations that update state
- Improvement path: Batch state updates or use reducer pattern

**PlayerApp Large Event Array:**
- Problem: All recording events held in memory via `eventsRef`
- Files: `src/entrypoints/player/PlayerApp.tsx:41`
- Cause: No pagination or streaming playback
- Improvement path: Implement event windowing for large recordings

## Fragile Areas

**Sync Engine Transaction Source Check:**
- Files: `src/lib/sync/SyncEngine.ts:19-22` (SyncTransaction interface)
- Why fragile: Hooks check `tx.source === 'sync'` to prevent loops, but incorrect source assignment causes sync failures
- Safe modification: Always use `db.transaction('rw', db.table, ...)` without source for UI-initiated operations

**Dexie Lifecycle Hooks:**
- Files: `src/db/index.ts` (implicit in SyncEngine patterns)
- Why fragile: Hooks (`creating`, `updating`, `deleting`) must check `tx.source === 'sync'` consistently
- Safe modification: Review all hook implementations when adding new tables

**Content Script Injection Timing:**
- Files: `src/entrypoints/zentao.content.tsx`, `src/entrypoints/recorder.content.ts`
- Why fragile: Multiple setTimeout delays for iframe checking (lines 566-572)
- Safe modification: Use MutationObserver with debouncing instead of fixed delays

**Network Interceptor Restore Pattern:**
- Files: `src/entrypoints/network-interceptor.ts:961`
- Why fragile: Relies on `restore` function being called on event to restore originals
- Safe modification: Ensure all code paths that stop recording call the restore event

## Scaling Limits

**IndexedDB Storage Quota:**
- Current capacity: Browser-specific (typically 50MB-10GB per origin)
- Limit: No explicit cleanup policy for recordings, blackboard items
- Scaling path: Implement automatic cleanup for old recordings and expired data

**Sync Operation Queue:**
- Current capacity: All operations stored in `operations` table until synced
- Limit: No batch size limits on push, but `PUSH_BATCH_SIZE=50` for reliability
- Scaling path: Consider server-side cursor pagination improvements

**AI Chat Message Accumulation:**
- Current capacity: All messages stored per session
- Limit: Large sessions (1000+ messages) may impact UI performance
- Scaling path: Implement session archival or compression triggers

## Dependencies at Risk

**rrweb Alpha Version:**
- Risk: Using `@rrweb/packer` and `@rrweb/types` at version `2.0.0-alpha.20`
- Impact: Breaking changes in alpha releases, no guaranteed stability
- Migration plan: Monitor rrweb stable releases, prepare migration guide

**page-agent:**
- Risk: Version `^1.6.1` - single source dependency
- Impact: If maintainer stops updates, extension's page automation breaks
- Migration plan: Fork and maintain locally if needed, or find alternative

**WXT Framework:**
- Risk: Version `^0.20.6` - critical dependency for extension architecture
- Impact: Framework bugs affect entire extension
- Migration plan: Consider vanilla web-extension approach as backup

## Missing Critical Features

**No Automatic Backup/Restore:**
- Problem: No way to export/import all data
- Blocks: Disaster recovery, device migration
- Priority: High

**No Offline Mode Indication:**
- Problem: Users don't know when sync is unavailable
- Files: `src/components/GlobalSyncButton.tsx`
- Priority: Medium

**No Recording Playback Speed Control Persistence:**
- Problem: Playback speed resets on reload
- Files: `src/entrypoints/player/PlayerApp.tsx:39`
- Priority: Low

## Test Coverage Gaps

**Untested Sync Engine:**
- What's not tested: Conflict resolution, deferred operations, operation regeneration
- Files: `src/lib/sync/SyncEngine.ts`
- Risk: Silent data loss in edge cases
- Priority: High

**Untested Network Interceptor:**
- What's not tested: Header parsing, streaming response handling, XHR wrapping
- Files: `src/entrypoints/network-interceptor.ts`
- Risk: Memory leaks, incorrect data capture
- Priority: High

**Untested AI Provider Implementations:**
- What's not tested: Ollama connection failures, Anthropic API errors, token refresh
- Files: `src/lib/ai/provider.ts`, `src/lib/ai/ollama.ts`
- Risk: Unhandled API errors crash AI assistant
- Priority: Medium

**No E2E Tests:**
- What's not tested: Full user workflows (create link -> tag -> sync -> retrieve)
- Risk: Integration breaks go unnoticed
- Priority: High

**No Performance Tests:**
- What's not tested: Large data set operations (1000+ links, 100+ tags)
- Risk: Performance regressions undetected
- Priority: Medium

---

*Concerns audit: 2026-03-26*
