# Architecture

**Analysis Date:** 2026-03-27

## Pattern Overview

**Overall:** Browser Extension (WXT) + React 19 + TypeScript with reactive database queries

**Key Characteristics:**
- **Extension Framework**: WXT (Web Extension Tools) provides build system and entrypoint management for Chrome/Firefox
- **UI Framework**: React 19 with TypeScript, functional components with hooks
- **Database**: Dexie.js (IndexedDB wrapper) with reactive queries via `dexie-react-hooks`
- **State Management**: Reactive database queries as primary state mechanism
- **Sync**: Custom E2EE sync engine using Web Crypto API with Last Write Wins (LWW) conflict resolution
- **AI**: Multi-provider AI integration (Ollama, WebLLM, Anthropic, OpenAI-compatible) with tool registry pattern
- **Message Routing**: Strategy pattern in background script for handling extension messages

## Layers

### Extension Entrypoints Layer
- **Purpose:** Browser extension entry points
- **Location:** `src/entrypoints/`
- **Contains:** Background service worker, side panel, options page, popup, content scripts, player
- **Depends on:** Features, lib modules
- **Used by:** Browser extension runtime

### Features Layer
- **Purpose:** Feature-specific business logic and UI
- **Location:** `src/features/{feature}/`
- **Contains:** Components, hooks, API clients, types, utilities
- **Sub-modules:**
  - `aiAssistant/` - AI chat interface
  - `blackboard/` - Note-taking
  - `hotNews/` - News feed
  - `jenkins/` - Jenkins integration
  - `links/` - URL bookmarking
  - `recorder/` - Session recording
  - `settings/` - Settings management
  - `tags/` - Tag management
  - `toolbox/` - Developer tools
- **Depends on:** lib modules, components, db
- **Used by:** Entrypoints, other features

### Library Layer
- **Purpose:** Cross-cutting functionality used by multiple features
- **Location:** `src/lib/`
- **Contains:** `ai/`, `db/`, `sync/`, `crypto/`, `pageAgent/`, `rrweb-plugins/`, `http.ts`
- **Key modules:**
  - `src/lib/db/` - Unified CRUD operations (links, tags, blackboard, jenkins, ai, settings, hotnews, recorder)
  - `src/lib/sync/` - E2EE sync engine with LWW conflict resolution
  - `src/lib/ai/` - AI tools registry, providers (Ollama, WebLLM, Anthropic)
  - `src/lib/crypto/` - Encryption via Web Crypto API
  - `src/lib/pageAgent/` - In-page automation
  - `src/lib/rrweb-plugins/` - Custom rrweb plugins for recording
- **Depends on:** db, types
- **Used by:** Features, entrypoints, background handlers

### Database Layer
- **Purpose:** Schema definition and database instance
- **Location:** `src/db/`, `src/db/index.ts`
- **Contains:** Dexie database instance, type definitions
- **Depends on:** Dexie
- **Used by:** lib/db operations, features

### Components Layer
- **Purpose:** Reusable UI primitives
- **Location:** `src/components/`
- **Contains:** `ui/` (shadcn components), shared components
- **Depends on:** UI library (shadcn/ui, UnoCSS)
- **Used by:** Features

### Hooks Layer
- **Purpose:** Global React hooks
- **Location:** `src/hooks/`
- **Contains:** `useTheme.ts`, `useGlobalSync.ts`
- **Depends on:** db, sync engine
- **Used by:** Entrypoints

### Config Layer
- **Purpose:** Constants and configuration
- **Location:** `src/config/`, `src/config/constants.ts`
- **Contains:** Feature flags, API endpoints, constants (SYNC, JENKINS, HOT_NEWS)
- **Used by:** Throughout codebase

### Utils Layer
- **Purpose:** General utilities
- **Location:** `src/utils/`
- **Contains:** `cn.ts` (classname utility), `logger.ts`, `modal.ts`, `validation.ts`, `confirm-dialog.tsx`, `base64.ts`
- **Used by:** Throughout codebase

## Data Flow

### Extension Message Flow
```
UI Component → browser.runtime.sendMessage() → Background Handler → Response
```

1. **UI Layer**: React component calls service method (e.g., `JenkinsService.fetchAllJobs()`)
2. **Service Layer**: `src/features/jenkins/service.ts` sends typed message via `browser.runtime.sendMessage()`
3. **Background Router**: `src/entrypoints/background.ts` receives message, uses strategy pattern to route to handler
4. **Handler**: `src/entrypoints/background/handlers/jenkins.ts` processes request, returns `JenkinsResponse`
5. **Response**: Promise resolves in service layer, UI updates via reactive query

### Database Sync Flow
```
Dexie CRUD → Hook captures change → Queue sync operation → Encrypt → Push to server
                                    ↓
                              Pull from server → Decrypt → Apply with LWW → Update DB
```

1. **Local Change**: Feature calls `lib/db/links.ts` function
2. **Hook Capture**: Dexie lifecycle hooks (`creating`, `updating`, `deleting`) in `SyncEngine` capture change
3. **Queue Operation**: `queueMicrotask` queues sync operation
4. **Push**: Operations encrypted with user's key, pushed to sync server
5. **Pull**: Remote operations pulled, decrypted, merged using LWW conflict resolution
6. **Update**: Changes applied to local Dexie database, triggering reactive UI updates

### AI Tool Execution Flow
```
User Input → AI Assistant → Tool Registry → Tool Handler → DB/Feature → Response
```

1. **User Input**: Chat message sent to AI Assistant
2. **AI Processing**: AI provider (Ollama/WebLLM/etc) processes message
3. **Tool Call**: Model requests tool execution via tool registry
4. **Confirmation**: If `requiresConfirmation`, user must approve
5. **Execution**: Tool handler calls `lib/db/` or feature API
6. **Response**: Result returned to AI model, final response shown to user

## Key Abstractions

### JenkinsService
- **Purpose:** Unified Jenkins API client for all features
- **Location:** `src/features/jenkins/service.ts`
- **Pattern:** Service that sends typed messages to background handlers

### ToolRegistry
- **Purpose:** Global registry for AI tools
- **Location:** `src/lib/ai/tools.ts`
- **Pattern:** Singleton registry with `register()`, `execute()`, `requiresConfirmation()`, `isYoloMode()`

### SyncEngine
- **Purpose:** E2EE sync with LWW conflict resolution
- **Location:** `src/lib/sync/SyncEngine.ts`
- **Pattern:** Class with Dexie hooks, event emitters, and sync lock

### Unified DB Operations
- **Purpose:** Unified data access layer
- **Location:** `src/lib/db/links.ts`, `src/lib/db/tags.ts`, `src/lib/db/blackboard.ts`, etc.
- **Pattern:** Functional API with transactions, soft-delete support

### Background Message Handlers
- **Purpose:** Message handling for background script
- **Location:** `src/entrypoints/background/handlers/jenkins.ts`, `src/entrypoints/background/handlers/sync.ts`
- **Pattern:** Module exports `handle*Message()` function, registered in `handlers/index.ts`

## Entry Points

### Background Script
- **Location:** `src/entrypoints/background.ts`
- **Triggers:** Extension install/update, browser startup, alarm events, network events, messages
- **Responsibilities:** Message routing, auto-sync setup, omnibox setup, side panel behavior

### Side Panel App
- **Location:** `src/entrypoints/sidepanel/App.tsx`
- **Triggers:** User clicks side panel icon
- **Responsibilities:** Tab-based navigation, lazy-loaded feature views, theme management, auto-pull sync

### Options Page
- **Location:** `src/entrypoints/options/main.tsx`
- **Triggers:** User opens extension options
- **Responsibilities:** Settings management, sync key management, Jenkins env management

### Content Scripts
- **Location:** `src/entrypoints/recorder.content.ts`, `src/entrypoints/jenkins.content.ts`, `src/entrypoints/zentao.content.tsx`, `src/entrypoints/pageAgent.content.ts`
- **Triggers:** Page load on configured URLs
- **Responsibilities:** Page-specific recording, Jenkins integration, PageAgent injection

### Recording Player
- **Location:** `src/entrypoints/player/PlayerApp.tsx`
- **Triggers:** Opening recording playback
- **Responsibilities:** rrweb replay with custom plugins

### Debug Tools
- **Location:** `src/entrypoints/debug/main.tsx`, `src/entrypoints/changelog/main.tsx`, `src/entrypoints/diff/main.tsx`, `src/entrypoints/tree-diff/main.tsx`
- **Triggers:** Direct URL access
- **Responsibilities:** Debug tools, changelog, data diff tools

## Error Handling

**Strategy:**
- Background handlers return `JenkinsResponse | { success: false, error: string }`
- Service layer wraps errors in descriptive messages
- UI components use `useToast` for error display
- Sync engine emits `sync-error` events for global error handling

**Logging:**
- Custom `logger` utility (`src/utils/logger.ts`)
- Structured logging with context
- Prefix: `[DPP]`
- Dev-only debug: `if (level === 'debug' && !isDev) return;`

**React Error Boundaries:**
- `ErrorBoundary` component at `src/components/ErrorBoundary.tsx`
- Graceful degradation for component errors

## Cross-Cutting Concerns

**Validation:**
- URL validation in `lib/db/links.ts` via `isValidUrl()`
- Tag name resolution with case-insensitive matching
- Environment variable validation for Jenkins credentials

**Security:**
- Jenkins credentials stored encrypted in IndexedDB
- Sync uses access tokens and E2EE (Web Crypto API)
- AI providers use API keys or local models

**Authentication:**
- Jenkins credentials stored per-environment in `jenkins_environments` setting
- Sync uses `sync_access_token` and `custom_server_url` settings

---

*Architecture analysis: 2026-03-27*
