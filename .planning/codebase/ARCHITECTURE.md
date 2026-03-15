# Architecture

**Analysis Date:** 2026-03-15

## Pattern Overview

**Overall:** Feature-Sliced Architecture with Message-Driven Communication

**Key Characteristics:**

- WXT extension framework with manifest-driven entry points
- Feature modules with vertical slice organization
- Centralized message routing through background service worker
- IndexedDB persistence with reactive queries via Dexie
- E2E encrypted sync engine with operation logging

## Layers

### Entry Points Layer

- Purpose: WXT-defined extension entry points (background, content scripts, UI pages)
- Location: `src/entrypoints/`
- Contains: Background handlers, content scripts, sidepanel/options UI
- Depends on: All feature modules, lib utilities, db layer
- Used by: Browser extension runtime

### Features Layer

- Purpose: Domain-specific business logic and UI components
- Location: `src/features/`
- Contains: Per-feature components, hooks, API clients, types
- Depends on: lib/db, lib utilities, components/ui
- Used by: Entry points (sidepanel, content scripts)

### Library Layer

- Purpose: Cross-cutting infrastructure and core services
- Location: `src/lib/`
- Contains: SyncEngine, crypto, AI providers, HTTP client, DB operations
- Depends on: db layer, utils
- Used by: Features layer, entry points

### Database Layer

- Purpose: Data persistence and schema definition
- Location: `src/db/`, `src/lib/db/`
- Contains: Dexie schema, typed CRUD operations, sync metadata
- Depends on: lib/crypto (for encryption), lib/sync (for sync engine)
- Used by: All layers

### UI Components Layer

- Purpose: Reusable presentation components
- Location: `src/components/ui/`
- Contains: Shadcn-style primitives (Button, Dialog, Input, etc.)
- Depends on: utils (cn), React
- Used by: Feature components

### Utilities Layer

- Purpose: Pure helper functions and constants
- Location: `src/utils/`, `src/config/`
- Contains: Logger, cn (className merger), validation, constants
- Depends on: No internal dependencies
- Used by: All layers

## Data Flow

### Message Flow (Background ↔ Content Scripts/UI)

1. UI component calls feature service/hook
2. Feature service sends browser.runtime.sendMessage()
3. Background script routes message to appropriate handler
4. Handler performs operation (API call, DB write, etc.)
5. Response sent back via sendResponse()
6. Feature service returns result to UI

**Example - Jenkins Build Trigger:**

```
JenkinsView.tsx
  → JenkinsService.triggerBuild()
    → browser.runtime.sendMessage({ type: 'JENKINS_TRIGGER_BUILD' })
      → background.ts message listener
        → handleJenkinsMessage()
          → fetch POST to Jenkins API
            → return response
```

### Sync Flow (Local ↔ Remote)

1. User action modifies local DB (Dexie hook triggers)
2. SyncEngine records operation in `operations` table
3. Auto-sync alarm or manual trigger calls `push()`
4. Operations encrypted with AES-GCM (Web Crypto API)
5. Encrypted payload sent to sync server
6. On pull, remote ops decrypted and applied to local DB
7. Conflict resolution via Last-Write-Wins (timestamp-based)

### Recording Flow (Content Script ↔ Background)

1. User clicks "Start Recording" in sidepanel
2. useRecorder hook sends RECORDER_START to background
3. Background sends RECORDER_INJECT to content script
4. Content script injects rrweb recorder + network/console interceptors
5. Events collected and sent to background on stop
6. Background saves recording to IndexedDB
7. Recording appears in RecordingsView via useLiveQuery

## Key Abstractions

### SyncEngine

- Purpose: Bidirectional sync with conflict resolution and E2E encryption
- Examples: `src/lib/sync/SyncEngine.ts`, `src/db/index.ts`
- Pattern: Observer pattern with Dexie hooks, operation logging

### ModelProvider (AI)

- Purpose: Abstraction over multiple AI backends (Ollama, OpenAI, Anthropic, WebLLM)
- Examples: `src/lib/ai/provider.ts`, `src/lib/ai/ollama.ts`, `src/lib/ai/webllm.ts`
- Pattern: Strategy pattern with factory creation

### Feature Services

- Purpose: Encapsulate feature-specific API calls and state management
- Examples: `src/features/jenkins/service.ts`, `src/features/recorder/hooks/useRecorder.ts`
- Pattern: Service layer with hook-based state management

### Tool Registry (AI)

- Purpose: Register and execute AI tools for function calling
- Examples: `src/lib/ai/tools.ts`, `src/lib/ai/tools/links.ts`
- Pattern: Registry pattern with dynamic tool registration

## Entry Points

### Background Service Worker

- Location: `src/entrypoints/background.ts`
- Triggers: Extension install, browser startup, runtime messages
- Responsibilities:
  - Message routing to feature handlers
  - Auto-sync scheduling via alarms API
  - Side panel configuration
  - Omnibox search handling

### Content Scripts

- Location: `src/entrypoints/*.content.ts`, `src/entrypoints/*.content.tsx`
- Triggers: Page load matching manifest patterns
- Responsibilities:
  - rrweb recording injection
  - Jenkins page integration
  - Zentao page integration
  - PageAgent injection

### Sidepanel UI

- Location: `src/entrypoints/sidepanel/`
- Triggers: User clicks extension icon
- Responsibilities:
  - Main feature tabs (Blackboard, Jenkins, Links, Recorder, HotNews, AI)
  - Tab state persistence
  - Auto-sync trigger on visibility change

### Player Page

- Location: `src/entrypoints/player/`
- Triggers: Opening recording from sidepanel
- Responsibilities:
  - rrweb replay with custom plugins
  - Network/console panel display

## Error Handling

**Strategy:** Layered error handling with user feedback

**Patterns:**

- UI layer: try-catch with toast notifications via `useToast()`
- Service layer: throw typed errors for upstream handling
- Background handlers: catch and return `{ success: false, error: message }`
- Logger: Structured logging with levels (debug, info, warn, error)

**Example:**

```typescript
// Feature service
async function fetchData() {
  try {
    const result = await api.getData();
    return result;
  } catch (err) {
    logger.error('Failed to fetch data', err);
    toast({ title: 'Error', description: 'Failed to fetch data' });
    throw err;
  }
}
```

## Cross-Cutting Concerns

### Logging

- Centralized logger with levels
- Location: `src/utils/logger.ts`
- Usage: `logger.info/warn/error/debug(message, data?)`

### Validation

- Zod schemas for API responses
- Location: `src/utils/validation.ts`
- Usage: Schema parsing for external data

### Authentication

- Per-feature credentials stored in settings
- Jenkins: Basic auth with API token
- Sync: Access token + E2E encryption key
- AI: Provider-specific API keys

### Theming

- CSS variables via UnoCSS
- Dark/light mode support
- Location: `src/hooks/useTheme.ts`, CSS variables in root

---

_Architecture analysis: 2026-03-15_
