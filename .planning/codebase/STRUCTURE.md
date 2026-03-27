# Codebase Structure

**Analysis Date:** 2026-03-27

## Directory Layout

```
/Users/slothluo/code/github/DPP/
├── src/
│   ├── entrypoints/           # Extension entry points
│   ├── features/              # Feature modules
│   ├── lib/                   # Shared libraries
│   ├── db/                    # Database schema
│   ├── components/             # UI components
│   ├── hooks/                 # React hooks
│   ├── config/                # Configuration
│   ├── utils/                 # Utilities
│   └── vendor/                # Vendored dependencies
├── packages/                  # Monorepo packages
│   ├── node-server/           # Node.js server
│   └── cf-worker-googlesheet/ # Cloudflare worker
├── public/                    # Static assets
├── docs/                      # Documentation
├── slides/                    # Presentation materials
├── wxt.config.ts              # WXT extension config
├── tsconfig.json              # TypeScript config
└── package.json               # Root package manifest
```

## Directory Purposes

### `src/entrypoints/`
- **Purpose:** Extension entry points (background, popup, options, content scripts)
- **Contains:**
  - `background.ts` - Service worker with message routing
  - `background/handlers/` - Handler modules (jenkins, sync, recorder, pageAgent, etc.)
  - `sidepanel/App.tsx` - Side panel UI
  - `options/main.tsx` - Settings page
  - `popup/App.tsx` - Browser action popup
  - `recorder.content.ts` - Session recording content script
  - `jenkins.content.ts` - Jenkins page integration
  - `pageAgent.content.ts` - Page agent injection
  - `player/PlayerApp.tsx` - Recording playback
  - `debug/main.tsx`, `diff/main.tsx`, `tree-diff/main.tsx` - Debug tools
  - `console-interceptor.ts`, `network-interceptor.ts` - Recording interceptors

### `src/features/`
- **Purpose:** Feature-specific modules with components, hooks, API clients
- **Contains:**
  - `aiAssistant/` - AI chat interface and tools
  - `blackboard/` - Note-taking feature
  - `hotNews/` - News feed feature
  - `jenkins/` - Jenkins integration (components, api, service, utils)
  - `links/` - URL bookmarking
  - `recorder/` - Session recording
  - `settings/` - Settings management UI
  - `tags/` - Tag management
  - `toolbox/` - Developer tools (regex, timestamp, json, diff)

### `src/lib/`
- **Purpose:** Cross-cutting functionality
- **Contains:**
  - `ai/` - AI tools registry, providers, tools
  - `crypto/` - Encryption via Web Crypto API
  - `db/` - Unified database CRUD operations
  - `sync/` - E2EE sync engine
  - `pageAgent/` - In-page automation
  - `rrweb-plugins/` - Custom rrweb plugins
  - `http.ts` - HTTP client

### `src/db/`
- **Purpose:** Database schema and Dexie instance
- **Contains:**
  - `index.ts` - Dexie database instance with schema
  - `types.ts` - Type definitions for database entities

### `src/components/`
- **Purpose:** Reusable UI primitives
- **Contains:**
  - `ui/` - Shadcn UI components (button, dialog, input, select, toast, etc.)
  - `ErrorBoundary.tsx` - React error boundary
  - `GlobalSyncButton.tsx` - Sync status button
  - `ThemeToggle.tsx` - Theme switcher
  - `Tips.tsx` - Tips display

### `src/hooks/`
- **Purpose:** Global React hooks
- **Contains:**
  - `useTheme.ts` - Theme management
  - `useGlobalSync.ts` - Sync state management

### `src/config/`
- **Purpose:** Constants and configuration
- **Contains:**
  - `constants.ts` - Feature flags, API endpoints, intervals

### `src/utils/`
- **Purpose:** General utilities
- **Contains:**
  - `cn.ts` - Classname utility (tailwind-merge + clsx)
  - `logger.ts` - Structured logging
  - `modal.ts` - Modal utilities
  - `validation.ts` - Validation helpers
  - `confirm-dialog.tsx` - Confirmation dialog
  - `base64.ts` - Base64 encoding

## Key File Locations

### Entry Points
- `src/entrypoints/background.ts` - Main background service worker
- `src/entrypoints/sidepanel/App.tsx` - Side panel UI entry
- `src/entrypoints/options/main.tsx` - Options page entry
- `src/entrypoints/player/PlayerApp.tsx` - Recording player entry

### Database
- `src/db/index.ts` - Dexie database definition (v1: links, jobs, settings, tags, etc.; v2: aiSessions, aiMessages; v3: remoteActivityLog)
- `src/db/types.ts` - TypeScript types for all entities

### Feature API/Service
- `src/features/jenkins/service.ts` - Jenkins service (sends messages to background)
- `src/features/jenkins/api/` - API clients (fetchJobs, fetchMyBuilds, build)
- `src/features/links/hooks/useLinks.ts` - Links data hook
- `src/features/recorder/hooks/useRecorder.ts` - Recorder hook
- `src/features/recorder/hooks/useRecordings.ts` - Recordings list hook
- `src/features/aiAssistant/hooks/useAIChat.ts` - AI chat hook

### Unified DB Operations (lib/db/)
- `src/lib/db/links.ts` - Link CRUD with soft-delete
- `src/lib/db/tags.ts` - Tag CRUD with soft-delete
- `src/lib/db/blackboard.ts` - Blackboard CRUD
- `src/lib/db/recorder.ts` - Recording metadata
- `src/lib/db/jenkins.ts` - Job/build data
- `src/lib/db/ai.ts` - AI sessions/messages
- `src/lib/db/settings.ts` - Settings management
- `src/lib/db/hotnews.ts` - Hot news cache
- `src/lib/db/remoteActivityLog.ts` - Remote activity tracking

### Sync
- `src/lib/sync/SyncEngine.ts` - Main sync engine with hooks, LWW conflict resolution
- `src/lib/sync/types.ts` - Sync types (SyncOperation, SyncProvider, etc.)
- `src/lib/sync/api.ts` - Sync API helpers
- `src/lib/sync/crypto-helpers.ts` - Encryption helpers
- `src/lib/globalSync.ts` - Global sync trigger

### AI
- `src/lib/ai/index.ts` - AI initialization, tool registration
- `src/lib/ai/tools.ts` - Tool registry class
- `src/lib/ai/tools/*.ts` - Feature-specific tools (links, jenkins, blackboard, etc.)
- `src/lib/ai/provider.ts` - Multi-provider support
- `src/lib/ai/ollama.ts` - Ollama integration
- `src/lib/ai/types.ts` - AI types

### Background Handlers
- `src/entrypoints/background/handlers/index.ts` - Handler exports
- `src/entrypoints/background/handlers/jenkins.ts` - Jenkins message handler
- `src/entrypoints/background/handlers/sync.ts` - Sync message handler
- `src/entrypoints/background/handlers/recorder.ts` - Recorder handler
- `src/entrypoints/background/handlers/pageAgent.ts` - Page agent handler
- `src/entrypoints/background/handlers/general.ts` - General handler
- `src/entrypoints/background/handlers/omnibox.ts` - Omnibox search
- `src/entrypoints/background/handlers/proxy.ts` - API proxy
- `src/entrypoints/background/handlers/remoteRecording.ts` - Remote recording

### Configuration
- `wxt.config.ts` - WXT extension configuration
- `tsconfig.json` - TypeScript config (extends .wxt/tsconfig.json)
- `eslint.config.js` - ESLint configuration
- `uno.config.ts` - UnoCSS configuration

## Naming Conventions

### Files
- **Components:** PascalCase (e.g., `LinksView.tsx`, `BlackboardView.tsx`, `ErrorBoundary.tsx`)
- **Hooks:** camelCase with `use` prefix (e.g., `useLinks.ts`, `useTheme.ts`, `useAIChat.ts`)
- **Services:** camelCase (e.g., `service.ts`, `client.ts`)
- **Utilities:** camelCase (e.g., `cn.ts`, `logger.ts`, `validation.ts`)
- **Handlers:** camelCase (e.g., `jenkins.ts`, `sync.ts`)
- **Types:** PascalCase (e.g., `types.ts`, `AIToolMetadata.ts`)
- **Constants:** SCREAMING_SNAKE_CASE in constants files, camelCase elsewhere

### Directories
- **Features:** kebab-case (e.g., `links/`, `blackboard/`, `aiAssistant/`)
- **Components:** kebab-case within feature (e.g., `features/links/components/`)
- **Lib modules:** kebab-case (e.g., `rrweb-plugins/`, `pageAgent/`)

### Functions/Variables
- **Functions:** camelCase (e.g., `addLink()`, `updateLink()`, `resolveTagNamesToIds()`)
- **React hooks:** `use` prefix (e.g., `useLiveQuery()`, `useTheme()`, `useLinks()`)
- **Message handlers:** `handle` prefix (e.g., `handleJenkinsMessage()`, `handleSyncMessage()`)
- **Getters:** `get` prefix (e.g., `getLink()`, `getClientId()`, `getSettingByKey()`)
- **Variables:** camelCase (e.g., `existingLink`, `tagIds`, `filteredLinks`)
- **Classes/Types:** PascalCase (e.g., `LinkItem`, `TagItem`, `SyncOperation`, `AIToolMetadata`)

### TypeScript Types
- **Interfaces:** PascalCase without "I" prefix (e.g., `AIToolMetadata`, not `IAIToolMetadata`)
- **Type aliases:** PascalCase for unions (e.g., `Theme = 'light' | 'dark' | 'system'`)
- **Enums:** PascalCase (e.g., `SyncStatus`)

## Where to Add New Code

### New Feature Module
```
src/features/{feature-name}/
├── components/
│   ├── {FeatureName}View.tsx    # Main view component
│   ├── {Component}.tsx          # Sub-components
│   └── index.ts                 # Barrel export
├── hooks/
│   ├── use{Feature}.ts          # Data hook
│   └── index.ts                 # Barrel export
├── api/
│   ├── client.ts                # API client
│   └── index.ts                 # Barrel export
├── types.ts                     # Feature types
├── utils.ts                     # Feature utilities
├── messages.ts                  # Message types
└── index.ts                     # Barrel export
```

### New Background Handler
1. Create `src/entrypoints/background/handlers/{feature}.ts`
2. Export `handle*Message()` function
3. Add export to `src/entrypoints/background/handlers/index.ts`
4. Add route to message handlers array in `src/entrypoints/background.ts`

### New AI Tool
1. Create tool handler in `src/lib/ai/tools/{feature}.ts`
2. Export `register*Tools()` function
3. Call registration in `src/lib/ai/index.ts`

### New DB Operation
1. Add function to appropriate `src/lib/db/{table}.ts`
2. Export from `src/lib/db/index.ts`
3. Use Dexie hooks in `src/lib/sync/SyncEngine.ts` if syncable

### New UI Component (Shadcn)
1. Add to `src/components/ui/{ComponentName}.tsx`
2. Component uses `class-variance-authority` for variants
3. Exported from `src/components/ui/index.ts`

### New Utility
1. Add to appropriate location in `src/utils/`
2. Export for use throughout codebase

## Special Directories

### `src/vendor/`
- **Purpose:** Vendored dependencies not available via package manager
- **Status:** Present but appears empty

### `.wxt/`
- **Purpose:** WXT build cache and generated files
- **Generated:** Yes
- **Committed:** No (typically in .gitignore)

### `.output/`
- **Purpose:** Built extension output
- **Generated:** Yes (by `pnpm build`)
- **Committed:** No

### `packages/`
- **Purpose:** Monorepo workspace packages
- **Contains:**
  - `node-server/` - Node.js server for sync backend
  - `cf-worker-googlesheet/` - Cloudflare worker for Google Sheets integration

---

*Structure analysis: 2026-03-27*
