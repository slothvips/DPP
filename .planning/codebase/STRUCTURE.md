# Codebase Structure

**Analysis Date:** 2026-03-27

## Directory Layout

```
DPP/
├── src/
│   ├── entrypoints/           # Extension entry points
│   │   ├── background.ts      # Service worker (main background)
│   │   ├── background/
│   │   │   └── handlers/      # Message handlers
│   │   ├── sidepanel/         # Side panel UI
│   │   ├── options/           # Options/settings page
│   │   ├── popup/             # Browser action popup
│   │   ├── player/            # Recording playback
│   │   ├── debug/             # Debug tools
│   │   ├── changelog/         # Changelog page
│   │   ├── diff/              # Diff tool page
│   │   ├── tree-diff/         # Tree diff tool
│   │   ├── recorder.content.ts # Recording content script
│   │   ├── jenkins.content.ts # Jenkins content script
│   │   ├── zentao.content.tsx # ZenTao content script
│   │   ├── pageAgent.content.ts # PageAgent content script
│   │   ├── console-interceptor.ts
│   │   └── network-interceptor.ts
│   ├── features/              # Feature modules
│   │   ├── aiAssistant/       # AI Assistant feature
│   │   ├── blackboard/        # Blackboard feature
│   │   ├── hotNews/           # Hot News feature
│   │   ├── jenkins/           # Jenkins integration
│   │   ├── links/             # Links management
│   │   ├── recorder/          # Session recording
│   │   ├── settings/          # Settings management
│   │   ├── tags/              # Tag management
│   │   └── toolbox/           # Developer tools
│   ├── lib/                   # Shared libraries
│   │   ├── ai/                # AI tools, providers, prompts
│   │   ├── crypto/            # Encryption utilities
│   │   ├── db/                # Database CRUD operations
│   │   ├── pageAgent/         # Page automation
│   │   ├── rrweb-plugins/     # Recording replay plugins
│   │   ├── sync/              # E2EE sync engine
│   │   └── http.ts            # HTTP utility
│   ├── components/            # Shared UI components
│   │   ├── ui/                # shadcn/ui components
│   │   └── *.tsx              # Shared components
│   ├── hooks/                 # Global React hooks
│   ├── config/                # Configuration constants
│   ├── db/                    # Database schema & types
│   ├── utils/                 # General utilities
│   └── vendor/                # Third-party type declarations
├── packages/                  # Monorepo packages
│   ├── node-server/           # Node.js backend server
│   └── cf-worker-googlesheet/ # Cloudflare worker
├── public/                    # Static assets
├── .planning/codebase/        # Architecture documentation
├── package.json               # Root package config
├── pnpm-workspace.yaml        # PNPM workspace config
└── wxt.config.ts              # WXT extension config
```

## Directory Purposes

**src/entrypoints/:**
- Purpose: Browser extension entry points (background, content scripts, pages)
- Contains: TypeScript files that WXT treats as entry points
- Key files:
  - `background.ts` - Service worker with message routing
  - `sidepanel/App.tsx` - Main side panel UI
  - `options/main.tsx` - Settings page
  - `recorder.content.ts` - rrweb recording injection

**src/features/:**
- Purpose: Feature-based code organization
- Contains: Each feature is a self-contained module with components, hooks, api, utils
- Structure:
  - `{feature}/components/{Feature}View.tsx` - Main view component
  - `{feature}/components/` - Feature-specific UI components
  - `{feature}/hooks/` - Feature-specific hooks
  - `{feature}/api/` - API client functions
  - `{feature}/utils/` - Feature utilities
  - `{feature}/types.ts` - Feature-specific types
  - `{feature}/messages.ts` - Message type definitions

**src/lib/:**
- Purpose: Shared business logic used by multiple features
- Contains:
  - `ai/` - Tool registry, providers, tools
  - `db/` - Unified database operations
  - `sync/` - Sync engine
  - `crypto/` - Encryption
  - `pageAgent/` - Page automation
  - `rrweb-plugins/` - Custom replay plugins
  - `http.ts` - HTTP client

**src/components/:**
- Purpose: Reusable UI components
- Contains:
  - `ui/` - shadcn/ui components (button, input, dialog, etc.)
  - `GlobalSyncButton.tsx` - Sync status button
  - `ThemeToggle.tsx` - Theme switcher
  - `ErrorBoundary.tsx` - Error boundary wrapper
  - `Tips.tsx` - Tips component

**src/hooks/:**
- Purpose: Global React hooks
- Contains:
  - `useTheme.ts` - Theme management
  - `useGlobalSync.ts` - Sync state hook

**src/db/:**
- Purpose: Database schema and instance
- Contains:
  - `index.ts` - Dexie database instance with migrations
  - `types.ts` - Database type definitions

**src/utils/:**
- Purpose: General-purpose utilities
- Contains:
  - `cn.ts` - Classname utility
  - `logger.ts` - Logging utility
  - `modal.ts` - Modal utilities
  - `validation.ts` - Validation helpers
  - `confirm-dialog.tsx` - Confirmation dialog provider
  - `base64.ts` - Base64 encoding

**src/config/:**
- Purpose: Application constants
- Contains:
  - `constants.ts` - Feature flags, API endpoints, defaults

## Key File Locations

**Entry Points:**
- `src/entrypoints/background.ts` - Background service worker
- `src/entrypoints/sidepanel/App.tsx` - Side panel UI entry
- `src/entrypoints/options/main.tsx` - Options page entry
- `src/entrypoints/player/PlayerApp.tsx` - Recording player entry

**Configuration:**
- `wxt.config.ts` - WXT build configuration
- `src/config/constants.ts` - App constants
- `src/db/index.ts` - Database schema
- `tsconfig.json` - TypeScript configuration

**Core Logic:**
- `src/lib/sync/SyncEngine.ts` - E2EE sync engine
- `src/lib/ai/tools.ts` - AI tool registry
- `src/lib/ai/index.ts` - AI initialization
- `src/lib/db/index.ts` - Database operations export

**Database:**
- `src/db/index.ts` - Dexie instance
- `src/db/types.ts` - Type definitions
- `src/lib/db/links.ts` - Links CRUD
- `src/lib/db/tags.ts` - Tags CRUD
- `src/lib/db/blackboard.ts` - Blackboard CRUD

**Background Handlers:**
- `src/entrypoints/background/handlers/jenkins.ts` - Jenkins messages
- `src/entrypoints/background/handlers/sync.ts` - Sync messages
- `src/entrypoints/background/handlers/recorder.ts` - Recorder messages
- `src/entrypoints/background/handlers/pageAgent.ts` - PageAgent messages
- `src/entrypoints/background/handlers/index.ts` - Handler exports

**Feature Views:**
- `src/features/jenkins/components/JenkinsView.tsx` - Jenkins main view
- `src/features/links/components/LinksView.tsx` - Links main view
- `src/features/blackboard/components/BlackboardView.tsx` - Blackboard view
- `src/features/recorder/components/RecordingsView.tsx` - Recordings view
- `src/features/aiAssistant/components/AIAssistantView.tsx` - AI assistant view
- `src/features/hotNews/components/HotNewsView.tsx` - Hot news view
- `src/features/toolbox/components/ToolboxView.tsx` - Toolbox view

**Shared Components:**
- `src/components/ui/button.tsx` - Button component
- `src/components/ui/dialog.tsx` - Dialog component
- `src/components/ui/input.tsx` - Input component
- `src/components/ui/toast.tsx` - Toast notification
- `src/components/ui/virtual-list.tsx` - Virtual list
- `src/components/ui/virtual-table.tsx` - Virtual table

## Naming Conventions

**Files:**
- Components: PascalCase (`JenkinsView.tsx`, `BuildDialog.tsx`)
- Utilities: camelCase (`buildTree.ts`, `statusHelpers.ts`)
- Handlers: camelCase with descriptive names (`handleJenkinsMessage.ts`)
- Types: camelCase (`types.ts`, `messages.ts`)
- Entry points: kebab-case or descriptive (`background.ts`, `sidepanel/main.tsx`)

**Directories:**
- Features: camelCase (`jenkins`, `aiAssistant`, `blackboard`)
- Components: camelCase (`components`, `hooks`)
- Lib modules: camelCase (`db`, `ai`, `sync`)

**Functions:**
- Hooks: camelCase with `use` prefix (`useLinks.ts`, `useRecorder.ts`)
- Service methods: camelCase (`fetchAllJobs`, `triggerBuild`)
- DB operations: camelCase or verb-noun (`listLinks`, `addLink`, `updateLink`)
- Tool handlers: camelCase or descriptive (`registerLinksTools`, `registerJenkinsTools`)

**Types:**
- Interfaces: PascalCase with optional `I` prefix or descriptive (`JenkinsEnvironment`, `LinkItem`)
- Type aliases: PascalCase (`JenkinsMessage`, `JenkinsResponse`)
- Enums: PascalCase

## Where to Add New Code

**New Feature:**
1. Create `src/features/{featureName}/`
2. Add `components/` with `src/features/{featureName}/components/{FeatureName}View.tsx`
3. Add feature-specific hooks in `src/features/{featureName}/hooks/`
4. Add API clients in `src/features/{featureName}/api/`
5. Add types in `src/features/{featureName}/types.ts`
6. Add messages in `src/features/{featureName}/messages.ts`
7. Export from `src/features/{featureName}/index.ts` if needed
8. Import and use in sidepanel App.tsx

**New Background Handler:**
1. Create `src/entrypoints/background/handlers/{handlerName}.ts`
2. Export `handle*Message()` function and message types
3. Register in `src/entrypoints/background/handlers/index.ts`
4. Add to message router in `src/entrypoints/background.ts`

**New Database Operation (lib/db):**
1. Add to existing file in `src/lib/db/` (e.g., `links.ts`) or create new file
2. Follow existing patterns with transactions and soft-delete support
3. Export from `src/lib/db/index.ts`

**New AI Tool:**
1. Create `src/lib/ai/tools/{toolName}.ts`
2. Export `register{ToolName}Tools()` function
3. Call registration in `src/lib/ai/index.ts`
4. Use `toolRegistry.register()` with metadata

**New UI Component:**
1. Shared: Add to `src/components/ui/` (shadcn components)
2. Feature-specific: Add to `src/features/{feature}/components/`

**New Hook:**
1. Global: Add to `src/hooks/`
2. Feature-specific: Add to `src/features/{feature}/hooks/`

**New Utility:**
1. Shared: Add to `src/utils/`
2. Feature-specific: Add to `src/features/{feature}/utils/`

## Special Directories

**src/vendor/rrweb/:**
- Purpose: Type declarations for rrweb
- Generated: No
- Committed: Yes

**src/db/ (Dexie):**
- Purpose: Database schema and instance
- Generated: No
- Committed: Yes
- Note: Uses incremental migrations

**packages/ (Monorepo):**
- Purpose: Separate deployable packages
- Contains: `node-server/` (Express server), `cf-worker-googlesheet/` (CF Worker)
- Generated: Build outputs in `dist/`
- Committed: Source only

**.output/ (WXT Build):**
- Purpose: Built extension files
- Generated: Yes (during build)
- Committed: No (in .gitignore)

**.wxt/ (WXT Cache):**
- Purpose: WXT temporary files and types
- Generated: Yes
- Committed: No

---

*Structure analysis: 2026-03-27*
