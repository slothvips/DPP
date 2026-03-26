# Architecture

**Analysis Date:** 2026-03-27

## Pattern Overview

**Overall:** WXT-based Browser Extension with Feature-Module Architecture + Strategy Pattern for Message Routing

**Key Characteristics:**
- **Extension Framework**: WXT (Web Extension Tools) provides the build system and entrypoint management
- **UI Framework**: React 19 with TypeScript, using functional components with hooks
- **Database**: Dexie.js (IndexedDB wrapper) with reactive queries via `dexie-react-hooks`
- **State**: Reactive database queries as the primary state mechanism
- **Sync**: Custom E2EE sync engine using Web Crypto API with Last Write Wins (LWW) conflict resolution
- **AI**: Multi-provider AI integration (Ollama, WebLLM, Anthropic, OpenAI-compatible) with tool registry pattern
- **Message Routing**: Strategy pattern in background script for handling extension messages

## Layers

**Extension Entrypoints (UI Layer):**
- Purpose: Browser extension entry points
- Location: `src/entrypoints/`
- Contains: Background service worker, side panel, options page, popup, content scripts, player
- Depends on: Features, lib modules
- Used by: Browser extension runtime

**Features Layer:**
- Purpose: Feature-specific business logic and UI
- Location: `src/features/{feature}/`
- Contains: Components, hooks, API clients, types, utilities
- Sub-modules:
  - `components/` - React UI components
  - `hooks/` - Feature-specific React hooks
  - `api/` - API client functions (where applicable)
  - `utils/` - Feature-specific utilities
- Depends on: lib modules, components, db
- Used by: Entrypoints, other features

**Lib Modules (Shared Business Logic):**
- Purpose: Cross-cutting functionality used by multiple features
- Location: `src/lib/`
- Contains: `ai/`, `db/`, `sync/`, `crypto/`, `pageAgent/`, `rrweb-plugins/`, `http.ts`
- Key modules:
  - `lib/ai/` - AI tool registry, providers, prompts
  - `lib/db/` - Unified database CRUD operations
  - `lib/sync/` - E2EE sync engine
  - `lib/crypto/` - Encryption utilities
  - `lib/pageAgent/` - Page automation via `page-agent` library
  - `lib/rrweb-plugins/` - Recording replay plugins
- Depends on: db, types
- Used by: Features, entrypoints, background handlers

**Database Layer:**
- Purpose: Schema definition and database instance
- Location: `src/db/`, `src/db/index.ts`
- Contains: Dexie database instance, type definitions
- Depends on: Dexie
- Used by: lib/db operations, features

**Components Layer:**
- Purpose: Reusable UI primitives
- Location: `src/components/`
- Contains: `ui/` (shadcn components), shared components
- Depends on: UI library (shadcn/ui, UnoCSS)
- Used by: Features

**Hooks Layer:**
- Purpose: Global React hooks
- Location: `src/hooks/`
- Contains: `useTheme.ts`, `useGlobalSync.ts`
- Depends on: db, sync engine
- Used by: Entrypoints

**Config Layer:**
- Purpose: Constants and configuration
- Location: `src/config/`, `src/config/constants.ts`
- Contains: Feature flags, API endpoints, constants
- Used by: Throughout codebase

**Utils Layer:**
- Purpose: General utilities
- Location: `src/utils/`
- Contains: `cn.ts` (classname utility), `logger.ts`, `modal.ts`, `validation.ts`, `confirm-dialog.tsx`, `base64.ts`
- Used by: Throughout codebase

## Data Flow

**User Interaction Flow (e.g., Jenkins build trigger):**

1. User clicks "Build" button in JenkinsView (`src/features/jenkins/components/JenkinsView.tsx`)
2. Component calls `JenkinsService.triggerBuild()` (`src/features/jenkins/service.ts`)
3. Service sends message via `browser.runtime.sendMessage()` with type `JENKINS_TRIGGER_BUILD`
4. Background script (`src/entrypoints/background.ts`) receives message
5. Message router matches `JENKINS_*` prefix, delegates to `handleJenkinsMessage()`
6. Handler (`src/entrypoints/background/handlers/jenkins.ts`) calls `triggerBuild()` API
7. API makes HTTP request to Jenkins, returns result
8. Handler returns response wrapped in `JenkinsResponse` format
9. Service receives response, returns to component
10. Component updates UI state

**Sync Data Flow:**

1. Database operation occurs via Dexie CRUD API
2. SyncEngine hooks (`creating`, `updating`, `deleting`) intercept the operation
3. Hook checks `tx.source !== 'sync'` to avoid infinite loops
4. For syncable tables (`tags`, `jobTags`, `links`, `linkTags`, `blackboard`), operation is queued
5. `queueMicrotask` defers sync operation queuing
6. `performGlobalSync()` triggers push to sync server
7. Operations are encrypted via Web Crypto API (E2EE)
8. Server stores only encrypted blobs
9. Pull operations decrypt incoming operations and apply via Dexie

**AI Tool Execution Flow:**

1. User interacts with AI Assistant
2. AI provider (Ollama/WebLLM/Anthropic) returns tool call request
3. `AIAssistantView` shows tool confirmation dialog if required
4. On confirm, `toolRegistry.execute()` is called
5. Tool handler (e.g., `registerLinksTools()`) calls `lib/db/` operations
6. DB operations trigger sync engine hooks
7. Result returned to AI provider for response generation

## Key Abstractions

**JenkinsService:**
- Purpose: Unified Jenkins API client for all features
- Examples: `src/features/jenkins/service.ts`
- Pattern: Service that sends typed messages to background handlers

**ToolRegistry:**
- Purpose: Global registry for AI tools
- Examples: `src/lib/ai/tools.ts`
- Pattern: Singleton registry with `register()`, `execute()`, `requiresConfirmation()`

**SyncEngine:**
- Purpose: E2EE sync with LWW conflict resolution
- Examples: `src/lib/sync/SyncEngine.ts`
- Pattern: Class with hooks, event emitters, and sync lock

**Database CRUD (lib/db):**
- Purpose: Unified data access layer
- Examples: `src/lib/db/links.ts`, `src/lib/db/tags.ts`, `src/lib/db/blackboard.ts`
- Pattern: Functional API with transactions, soft-delete support

**Background Handlers:**
- Purpose: Message handling for background script
- Examples: `src/entrypoints/background/handlers/jenkins.ts`, `src/entrypoints/background/handlers/sync.ts`
- Pattern: Module exports `handle*Message()` function, registered in `handlers/index.ts`

## Entry Points

**Background Service Worker:**
- Location: `src/entrypoints/background.ts`
- Triggers: Extension install/update, browser startup, alarm events, network events
- Responsibilities: Message routing, auto-sync setup, omnibox setup, side panel behavior

**Side Panel (Main UI):**
- Location: `src/entrypoints/sidepanel/App.tsx`
- Triggers: User clicks side panel icon
- Responsibilities: Tab-based navigation, lazy-loaded feature views, theme management, auto-pull sync

**Options Page:**
- Location: `src/entrypoints/options/main.tsx`
- Triggers: User opens extension options
- Responsibilities: Settings management, sync key management, Jenkins env management

**Popup:**
- Location: `src/entrypoints/popup/App.tsx` (referenced but structure shown in sidepanel pattern)
- Triggers: User clicks browser action

**Content Scripts:**
- Location: `src/entrypoints/recorder.content.ts`, `src/entrypoints/jenkins.content.ts`, `src/entrypoints/zentao.content.tsx`, `src/entrypoints/pageAgent.content.ts`
- Triggers: Page load on configured URLs
- Responsibilities: Page-specific recording, Jenkins integration, PageAgent injection

**Player:**
- Location: `src/entrypoints/player/PlayerApp.tsx`
- Triggers: Opening recording playback
- Responsibilities: rrweb replay with custom plugins

**Debug/Other:**
- Location: `src/entrypoints/debug/main.tsx`, `src/entrypoints/changelog/main.tsx`, `src/entrypoints/diff/main.tsx`, `src/entrypoints/tree-diff/main.tsx`
- Triggers: Direct URL access
- Responsibilities: Debug tools, changelog, data diff tools

## Error Handling

**Strategy:** Try-catch with typed error responses

**Patterns:**
- Background handlers return `JenkinsResponse | { success: false, error: string }`
- Service layer wraps errors in descriptive messages
- UI components use `useToast` for error display
- Sync engine emits `sync-error` events for global error handling

**Logging:**
- Custom `logger` utility (`src/utils/logger.ts`)
- Structured logging with context
- Service worker and background contexts use different logging transports

## Cross-Cutting Concerns

**Logging:** Custom `logger` utility wrapping console with context awareness

**Validation:**
- URL validation in `lib/db/links.ts` via `isValidUrl()`
- Tag name resolution with case-insensitive matching
- Environment variable validation for Jenkins credentials

**Authentication:**
- Jenkins credentials stored encrypted in IndexedDB
- Sync uses access tokens and E2EE
- AI providers use API keys or local models

**Error Boundaries:**
- React `ErrorBoundary` component at `src/components/ErrorBoundary.tsx`
- Graceful degradation for component errors

---

*Architecture analysis: 2026-03-27*
