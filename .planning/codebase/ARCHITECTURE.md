# Architecture

**Analysis Date:** 2026-03-26

## Pattern Overview

**Overall:** Feature-based modular architecture with message-driven background service

**Key Characteristics:**
- **Browser Extension (WXT):** Multi-entrypoint extension with side panel, options, popup, and background service worker
- **Feature Modules:** Self-contained feature directories (`src/features/{name}/`) containing components, hooks, API clients, and utilities
- **Message Routing:** Strategy pattern in background script routes messages to feature-specific handlers based on message type prefix
- **Unified Data Layer:** Dexie.js (IndexedDB) with unified CRUD operations in `src/lib/db/`
- **Sync Engine:** Last Write Wins (LWW) conflict resolution with E2EE encryption

## Layers

**Extension Entrypoints Layer:**
- Purpose: Bootstrap extension functionality and route to appropriate handlers
- Location: `src/entrypoints/`
- Contains: Background service worker, side panel, content scripts, options page, player
- Depends on: Handlers, database, hooks
- Used by: Browser extension runtime

**Background Handler Layer:**
- Purpose: Handle messages from UI and content scripts, orchestrate feature logic
- Location: `src/entrypoints/background/handlers/`
- Contains: `jenkins.ts`, `sync.ts`, `recorder.ts`, `pageAgent.ts`, `proxy.ts`, `omnibox.ts`, `remoteRecording.ts`, `general.ts`
- Depends on: Feature APIs (`src/features/{name}/api/`), database operations, external services
- Used by: Background script entrypoint via strategy pattern

**Feature Layer:**
- Purpose: Implement feature-specific UI, state, and business logic
- Location: `src/features/{name}/`
- Contains: Components (`components/`), hooks (`hooks/`), API clients (`api/`), types, utils
- Depends on: UI components, database layer, http utilities
- Used by: Handlers, other features, side panel views

**Database Layer:**
- Purpose: Abstract all data persistence with unified CRUD operations
- Location: `src/lib/db/`, `src/db/`
- Contains: Dexie schema (`src/db/`), CRUD operations (`src/lib/db/*.ts`)
- Key files:
  - `src/db/index.ts`: Database schema and initialization
  - `src/db/types.ts`: TypeScript interfaces for all entities
  - `src/lib/db/links.ts`: Link CRUD operations
  - `src/lib/db/tags.ts`: Tag CRUD operations
  - `src/lib/db/blackboard.ts`: Blackboard CRUD operations
  - `src/lib/db/jenkins.ts`: Jenkins build/history operations
  - `src/lib/db/settings.ts`: Settings persistence
- Depends on: Dexie library
- Used by: Handlers, feature hooks, AI tools

**Sync Layer:**
- Purpose: Synchronize encrypted data with remote server
- Location: `src/lib/sync/`
- Key files:
  - `src/lib/sync/SyncEngine.ts`: Core sync logic with LWW conflict resolution
  - `src/lib/sync/types.ts`: Sync operation types
  - `src/lib/sync/api.ts`: Sync API wrapper
  - `src/lib/sync/crypto-helpers.ts`: Encryption utilities
  - `src/lib/globalSync.ts`: Orchestrates sync across database, Jenkins, and hotnews
- Depends on: Database, crypto utilities, http layer
- Used by: Background handlers, UI components

**AI Tools Layer:**
- Purpose: Provide AI-assisted functionality via tool registry
- Location: `src/lib/ai/`
- Contains: Tool registry (`tools.ts`), provider implementations, tool definitions (`tools/*.ts`)
- Key files:
  - `src/lib/ai/index.ts`: Tool registration (calls all `register*Tools()` functions)
  - `src/lib/ai/tools.ts`: `ToolRegistry` class with `register()`, `execute()`, `requiresConfirmation()`
  - `src/lib/ai/tools/links.ts`, `tags.ts`, `jenkins.ts`, etc.: Feature-specific tool definitions
  - `src/lib/ai/provider.ts`: Multi-provider AI support (Ollama, WebLLM, Anthropic, OpenAI)
- Depends on: Database layer, page agent
- Used by: AI Assistant UI component

**Page Agent Layer:**
- Purpose: Inject automation agent into web pages
- Location: `src/lib/pageAgent/`
- Contains: `injector.ts` (tab management, injection logic), `types.ts`
- Depends on: Content script (`pageAgent.content.ts`)
- Used by: Background handler, AI tools

**Utilities Layer:**
- Purpose: Shared utilities for logging, HTTP, validation, styling
- Location: `src/utils/`
- Key files:
  - `src/utils/logger.ts`: Structured logging
  - `src/utils/cn.ts`: Class name merging (clsx + tailwind-merge)
  - `src/utils/confirm-dialog.tsx`: Confirmation dialog provider
  - `src/lib/http.ts`: HTTP client with timeout and retry
  - `src/lib/crypto/encryption.ts`: Web Crypto API E2EE implementation
- Depends on: Browser APIs, external libraries
- Used by: All layers

**UI Components Layer:**
- Purpose: Reusable UI building blocks
- Location: `src/components/ui/`
- Contains: Shadcn-style components (button, input, dialog, select, etc.)
- Depends on: Radix UI primitives, Lucide icons
- Used by: Feature views

## Data Flow

**Message Flow (Background Service):**
1. User action in UI or content script triggers `browser.runtime.sendMessage()`
2. Background service (`src/entrypoints/background.ts`) receives message
3. Message router iterates through handler array with `match()` predicates
4. First matching handler processes message and returns response
5. Response sent back to caller via `sendResponse()`

**Data Sync Flow:**
1. Local change triggers Dexie hook (`creating`, `updating`, `deleting`)
2. Hook records sync operation in `operations` table with timestamp
3. Hook queues `AUTO_SYNC_TRIGGER_PUSH` message
4. Background sync handler calls `SyncEngine.push()`
5. Operations encrypted with user's key and pushed to server
6. Server responds with cursor; local cursor updated

**Pull Flow:**
1. Auto-pull triggered on side panel visibility or alarm
2. Background sync handler calls `SyncEngine.pull()`
3. Encrypted operations fetched from server since last cursor
4. Operations decrypted and applied with LWW conflict resolution
5. Remote activity logged for UI display

**AI Tool Execution Flow:**
1. User sends message to AI Assistant
2. AI provider processes with tool definitions from registry
3. If tool requires confirmation, dialog shown to user
4. Tool handler calls unified DB operations (`src/lib/db/*.ts`)
5. Result returned to AI provider for response generation

## Key Abstractions

**ToolRegistry (src/lib/ai/tools.ts):**
- Purpose: Global registry for AI tools with registration, execution, and confirmation
- Examples: `registerLinksTools()`, `registerJenkinsTools()`, `registerPageAgentTools()`
- Pattern: Singleton registry with `register()`, `execute()`, `getAll()`, `requiresConfirmation()`

**SyncEngine (src/lib/sync/SyncEngine.ts):**
- Purpose: Manages bidirectional sync with LWW conflict resolution
- Examples: `push()`, `pull()`, `recordOperation()`, `getPendingCounts()`
- Pattern: Class with event emitter (`on()`, `emit()`), retry logic, batch processing

**JenkinsCredentials (src/entrypoints/background/handlers/jenkins.ts):**
- Purpose: Resolve Jenkins credentials from multiple environments
- Examples: `getJenkinsCredentials(targetEnvId?)`
- Pattern: Environment-based credential resolution with legacy fallback

**Dexie Hooks (src/lib/sync/SyncEngine.ts):**
- Purpose: Intercept database changes for sync tracking
- Examples: `table.hook('creating')`, `table.hook('updating')`, `table.hook('deleting')`
- Pattern: Hook checks `tx.source === 'sync'` to skip self-triggered operations

## Entry Points

**Background Service Worker:**
- Location: `src/entrypoints/background.ts`
- Triggers: Extension install/update, message received, alarm, network status change
- Responsibilities: Message routing, auto-sync setup, omnibox, side panel behavior

**Side Panel:**
- Location: `src/entrypoints/sidepanel/App.tsx`
- Triggers: User clicks extension icon
- Responsibilities: Tab-based navigation (blackboard, jenkins, links, recorder, hotnews, aiAssistant, toolbox), auto-pull on visibility

**Content Scripts:**
- Location: `src/entrypoints/recorder.content.ts`, `src/entrypoints/pageAgent.content.ts`, `src/entrypoints/jenkins.content.ts`
- Triggers: Page load or specific URL patterns
- Responsibilities: rrweb recording, page agent injection, Jenkins page enhancement

**Options Page:**
- Location: `src/entrypoints/options/main.tsx`
- Triggers: User opens extension options
- Responsibilities: Settings UI, theme toggle, sync configuration, data export/import

**Player:**
- Location: `src/entrypoints/player/PlayerApp.tsx`
- Triggers: User opens recording playback
- Responsibilities: Session replay with console/network panels

**Debugger:**
- Location: `src/entrypoints/debug/main.tsx`
- Triggers: Development mode
- Responsibilities: Testing and debugging tools

## Error Handling

**Strategy:** Layered error handling with logging at boundaries

**Patterns:**
- **Handlers:** Try-catch with structured error responses `{ success: false, error: string }`
- **Database:** Transactions with rollback, constraint error recovery
- **Sync:** Retry with exponential backoff, status tracking (`idle`, `pushing`, `pulling`, `error`)
- **HTTP:** Timeout with AbortController, retry with exponential backoff
- **UI:** Toast notifications for user feedback, error boundaries for component crashes

## Cross-Cutting Concerns

**Logging:** `src/utils/logger.ts` provides structured logging with timestamps and error stacks

**Validation:** `src/utils/validation.ts` contains URL and input validation utilities

**Authentication:** Jenkins credentials stored in settings, sync uses access token + encryption key

**State Management:** Dexie with `useLiveQuery` from `dexie-react-hooks` for reactive data access

---

*Architecture analysis: 2026-03-26*
