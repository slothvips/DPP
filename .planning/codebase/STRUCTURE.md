# Codebase Structure

**Analysis Date:** 2026-03-15

## Directory Layout

```
src/
├── components/           # Shared UI components
│   └── ui/               # Shadcn-style primitives
├── config/               # Application constants
├── db/                   # Dexie schema and types
├── entrypoints/          # WXT extension entry points
│   ├── background/       # Background service worker modules
│   │   └── handlers/     # Message handlers by domain
│   ├── changelog/        # Changelog page
│   ├── debug/            # Debug page
│   ├── options/          # Extension options page
│   ├── player/           # Recording player page
│   └── sidepanel/        # Main sidepanel UI
├── features/             # Domain feature modules
│   ├── aiAssistant/      # AI chat assistant
│   ├── blackboard/       # Quick notes/scratchpad
│   ├── hotNews/          # Aggregated news feed
│   ├── jenkins/          # Jenkins CI integration
│   ├── links/            # Link management
│   ├── recorder/         # Session recording/replay
│   ├── settings/         # Settings components
│   └── tags/             # Tag management
├── hooks/                # Shared React hooks
├── lib/                  # Core libraries and services
│   ├── ai/               # AI providers and tools
│   │   └── tools/        # AI function calling tools
│   ├── crypto/           # E2E encryption utilities
│   ├── db/               # Database operation modules
│   ├── pageAgent/        # Page automation agent
│   ├── rrweb-plugins/    # Custom rrweb plugins
│   └── sync/             # Sync engine and types
├── utils/                # Helper functions
└── vendor/               # Vendored third-party code
    └── rrweb/            # rrweb types
```

## Directory Purposes

### `src/components/`

- Purpose: Reusable UI components shared across features
- Contains: Shadcn-style primitives with UnoCSS styling
- Key files: `ui/button.tsx`, `ui/dialog.tsx`, `ui/toast.tsx`, `ui/virtual-list.tsx`

### `src/config/`

- Purpose: Application-wide constants and configuration
- Contains: Hot news sources, default values, feature flags
- Key files: `constants.ts`

### `src/db/`

- Purpose: Database schema definition and Dexie instance
- Contains: Table schemas, type exports, sync engine initialization
- Key files: `index.ts` (Dexie instance + schema), `types.ts` (all DB types)

### `src/entrypoints/`

- Purpose: WXT-defined extension entry points
- Contains: Background script, content scripts, UI pages
- Key files: `background.ts` (message router), `sidepanel/App.tsx` (main UI)

### `src/entrypoints/background/handlers/`

- Purpose: Domain-specific message handlers for background script
- Contains: One handler module per feature (jenkins, recorder, sync, etc.)
- Key files: `index.ts` (exports), `jenkins.ts`, `recorder.ts`, `sync.ts`

### `src/features/`

- Purpose: Vertical slice feature modules
- Contains: Components, hooks, API clients, types per feature
- Structure per feature:
  ```
  <feature>/
  ├── api/           # API client functions
  ├── components/    # Feature-specific UI
  ├── hooks/         # Feature-specific hooks
  ├── utils/         # Feature-specific utilities
  ├── messages.ts    # Message type definitions
  ├── service.ts     # Service layer (optional)
  └── types.ts       # Feature types
  ```

### `src/features/jenkins/`

- Purpose: Jenkins CI server integration
- Contains: Job/build management, environment switching, triggering builds
- Key files: `api/client.ts`, `api/fetchJobs.ts`, `components/JenkinsView.tsx`

### `src/features/recorder/`

- Purpose: Browser session recording and replay
- Contains: Recording control, recordings list, rrweb integration
- Key files: `hooks/useRecorder.ts`, `components/RecordingsView.tsx`

### `src/features/aiAssistant/`

- Purpose: AI-powered assistant with tool calling
- Contains: Chat UI, AI provider integration, tool execution
- Key files: `hooks/useAIChat.ts`, `components/AIAssistantView.tsx`

### `src/hooks/`

- Purpose: Shared React hooks used across features
- Contains: Theme management, global sync state
- Key files: `useTheme.ts`, `useGlobalSync.ts`

### `src/lib/`

- Purpose: Core infrastructure and cross-cutting services
- Contains: Sync engine, crypto, AI providers, HTTP client, DB operations

### `src/lib/ai/`

- Purpose: AI provider abstraction and tool system
- Contains: Multiple provider implementations, tool registry
- Key files: `provider.ts` (factory), `tools.ts` (registry), `prompt.ts`

### `src/lib/db/`

- Purpose: Database operation modules by domain
- Contains: CRUD functions for each DB table
- Key files: `links.ts`, `jenkins.ts`, `recorder.ts`, `settings.ts`, `index.ts` (re-exports all)

### `src/lib/sync/`

- Purpose: E2E encrypted synchronization engine
- Contains: SyncEngine class, crypto helpers, types
- Key files: `SyncEngine.ts`, `crypto-helpers.ts`, `types.ts`

### `src/lib/crypto/`

- Purpose: End-to-end encryption utilities
- Contains: Key generation, encryption/decryption, key storage
- Key files: `encryption.ts`

### `src/utils/`

- Purpose: Pure utility functions with no side effects
- Contains: Logger, className merger, validation, dialogs
- Key files: `logger.ts`, `cn.ts`, `validation.ts`, `confirm-dialog.tsx`

### `src/vendor/`

- Purpose: Vendored third-party code and types
- Contains: rrweb type definitions
- Key files: `rrweb/rrweb.d.ts`

## Key File Locations

### Entry Points

- `src/entrypoints/background.ts`: Background service worker (message router)
- `src/entrypoints/sidepanel/App.tsx`: Main sidepanel UI
- `src/entrypoints/player/PlayerApp.tsx`: Recording player UI
- `src/entrypoints/recorder.content.ts`: Recording content script
- `src/entrypoints/jenkins.content.ts`: Jenkins page integration

### Database

- `src/db/index.ts`: Dexie instance, schema definition, sync engine setup
- `src/db/types.ts`: All database table type definitions
- `src/lib/db/index.ts`: Re-exports all DB operation modules

### Sync

- `src/lib/sync/SyncEngine.ts`: Core synchronization engine
- `src/lib/crypto/encryption.ts`: E2E encryption utilities
- `src/lib/globalSync.ts`: Global sync orchestration

### AI

- `src/lib/ai/provider.ts`: AI provider factory and implementations
- `src/lib/ai/tools.ts`: Tool registry and execution
- `src/lib/ai/prompt.ts`: System prompt generation

### Utilities

- `src/utils/logger.ts`: Structured logging
- `src/utils/cn.ts`: Tailwind class merger
- `src/config/constants.ts`: Application constants

## Naming Conventions

### Files

- Components: `PascalCase.tsx` (e.g., `JenkinsView.tsx`, `Button.tsx`)
- Utilities: `camelCase.ts` (e.g., `logger.ts`, `buildTree.ts`)
- Types: `types.ts` per feature or `types.ts` in db/
- Content scripts: `*.content.ts` or `*.content.tsx`
- Handlers: `camelCase.ts` (e.g., `jenkins.ts`, `recorder.ts`)

### Directories

- Features: `camelCase` (e.g., `aiAssistant`, `hotNews`)
- UI components: `ui/` subdirectory
- API clients: `api/` subdirectory within feature
- Hooks: `hooks/` subdirectory within feature or shared

## Where to Add New Code

### New Feature

- Primary code: `src/features/<feature-name>/`
- Components: `src/features/<feature-name>/components/`
- Hooks: `src/features/<feature-name>/hooks/`
- API: `src/features/<feature-name>/api/`
- Types: `src/features/<feature-name>/types.ts`
- Messages: `src/features/<feature-name>/messages.ts`
- Background handler: `src/entrypoints/background/handlers/<feature>.ts`
- Register handler: Add export to `handlers/index.ts`, add routing in `background.ts`

### New UI Component

- Shared component: `src/components/ui/<ComponentName>.tsx`
- Feature-specific: `src/features/<feature>/components/<ComponentName>.tsx`

### New Database Table

- Schema: Add to `src/db/index.ts` version definition
- Types: Add types to `src/db/types.ts`
- Operations: Create `src/lib/db/<table>.ts`
- Export: Add to `src/lib/db/index.ts`
- Sync: Add table name to SyncEngine tables array in `src/db/index.ts`

### New AI Tool

- Implementation: `src/lib/ai/tools/<toolName>.ts`
- Register: Call `registerXxxTools()` in `src/lib/ai/index.ts`
- Export: Add to `src/lib/ai/index.ts` exports

### New Content Script

- File: `src/entrypoints/<name>.content.ts` (or `.tsx`)
- WXT auto-discovers files matching `*.content.ts` pattern

### New Background Handler

- File: `src/entrypoints/background/handlers/<domain>.ts`
- Export: Add to `src/entrypoints/background/handlers/index.ts`
- Route: Add message type check in `src/entrypoints/background.ts`

## Special Directories

### `.output/`

- Purpose: WXT build output
- Generated: Yes (by `pnpm build`)
- Committed: No (in .gitignore)

### `.wxt/`

- Purpose: WXT cache and generated files
- Generated: Yes (by WXT dev/build)
- Committed: No (in .gitignore)

### `public/`

- Purpose: Static assets copied to extension root
- Generated: No
- Committed: Yes

---

_Structure analysis: 2026-03-15_
