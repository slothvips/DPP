# Codebase Structure

**Analysis Date:** 2026-03-26

## Directory Layout

```
DPP/
├── src/
│   ├── entrypoints/           # Extension entry points
│   │   ├── background.ts     # Service worker main entry
│   │   ├── background/       # Background handlers
│   │   │   └── handlers/
│   │   ├── sidepanel/        # Side panel UI
│   │   ├── options/          # Settings page
│   │   ├── player/           # Recording playback
│   │   ├── debug/            # Debug utilities
│   │   ├── changelog/        # Changelog page
│   │   ├── tree-diff/        # Data diff tool
│   │   ├── diff/             # Generic diff tool
│   │   ├── zentao.content.tsx # Content script for Zentao
│   │   ├── recorder.content.ts # rrweb recording content
│   │   └── pageAgent.content.ts # Page agent injection
│   ├── features/             # Feature modules
│   │   ├── aiAssistant/
│   │   ├── blackboard/
│   │   ├── hotNews/
│   │   ├── jenkins/
│   │   ├── links/
│   │   ├── recorder/
│   │   ├── settings/
│   │   ├── tags/
│   │   └── toolbox/
│   ├── lib/                  # Shared libraries
│   │   ├── ai/               # AI tools and providers
│   │   ├── crypto/           # Encryption utilities
│   │   ├── db/               # Unified database CRUD
│   │   ├── pageAgent/        # Page agent injector
│   │   ├── rrweb-plugins/    # Recording replay plugins
│   │   └── sync/             # Sync engine
│   ├── components/           # Shared UI components
│   │   └── ui/               # Shadcn-style components
│   ├── hooks/                # Global React hooks
│   ├── config/               # Configuration constants
│   ├── db/                   # Database schema (Dexie)
│   └── utils/                # Utility functions
├── packages/                 # Monorepo packages
│   ├── node-server/          # Node.js backend
│   └── cf-worker-googlesheet/ # Cloudflare worker
├── public/                   # Static assets
└── wxt.config.ts             # WXT extension config
```

## Directory Purposes

**src/entrypoints/:**
- Purpose: Extension entry points (background, sidepanel, content scripts, options)
- Contains: TypeScript files that define extension entry points
- Key files:
  - `src/entrypoints/background.ts`: Main background service worker
  - `src/entrypoints/sidepanel/App.tsx`: Side panel root component

**src/entrypoints/background/handlers/:**
- Purpose: Feature-specific message handlers for background service
- Contains: Handler modules for each feature area
- Key files:
  - `src/entrypoints/background/handlers/index.ts`: Exports all handlers
  - `src/entrypoints/background/handlers/jenkins.ts`: Jenkins job/build operations
  - `src/entrypoints/background/handlers/sync.ts`: Sync trigger and status
  - `src/entrypoints/background/handlers/recorder.ts`: Recording management
  - `src/entrypoints/background/handlers/pageAgent.ts`: Page agent injection
  - `src/entrypoints/background/handlers/proxy.ts`: Proxy for external API requests
  - `src/entrypoints/background/handlers/omnibox.ts`: Omnibox search
  - `src/entrypoints/background/handlers/remoteRecording.ts`: Remote recording fetch
  - `src/entrypoints/background/handlers/general.ts`: General settings operations

**src/features/:**
- Purpose: Feature-specific modules with UI, hooks, and API clients
- Contains: Feature directories with co-located components, hooks, api, types
- Structure per feature:
  ```
  features/{name}/
  ├── components/     # Feature UI components (View suffix)
  ├── hooks/          # React hooks for data access
  ├── api/            # API clients (if needed)
  ├── types.ts        # Feature-specific types
  ├── messages.ts     # Message type definitions
  └── utils.ts        # Feature utilities
  ```

**src/lib/ai/tools/:**
- Purpose: AI tool definitions registered with the global tool registry
- Contains: Tool implementations for each feature
- Key files:
  - `src/lib/ai/tools/links.ts`: Link management tools
  - `src/lib/ai/tools/tags.ts`: Tag management tools
  - `src/lib/ai/tools/jenkins.ts`: Jenkins job/build tools
  - `src/lib/ai/tools/blackboard.ts`: Blackboard tools
  - `src/lib/ai/tools/recorder.ts`: Recording tools
  - `src/lib/ai/tools/hotnews.ts`: Hot news tools
  - `src/lib/ai/tools/browser.ts`: Browser automation tools
  - `src/lib/ai/tools/pageAgent.ts`: Page agent control tools
  - `src/lib/ai/tools/agent.ts`: Agent management tools
  - `src/lib/ai/tools/recentActivities.ts`: Activity tracking tools

**src/lib/db/:**
- Purpose: Unified database CRUD operations used by both AI tools and UI
- Contains: Database operation modules per entity
- Key files:
  - `src/lib/db/index.ts`: Exports all DB operations
  - `src/lib/db/links.ts`: Link CRUD with pagination, filtering, bulk operations
  - `src/lib/db/tags.ts`: Tag CRUD with soft delete and association management
  - `src/lib/db/blackboard.ts`: Blackboard item CRUD
  - `src/lib/db/jenkins.ts`: Jenkins job and build history operations
  - `src/lib/db/recorder.ts`: Recording metadata CRUD
  - `src/lib/db/settings.ts`: Settings persistence
  - `src/lib/db/ai.ts`: AI session and message persistence
  - `src/lib/db/hotnews.ts`: Hot news cache operations
  - `src/lib/db/remoteActivityLog.ts`: Remote activity tracking

**src/db/:**
- Purpose: Dexie database schema and type definitions
- Contains: Database initialization and type exports
- Key files:
  - `src/db/index.ts`: Dexie database instance with schema migrations
  - `src/db/types.ts`: TypeScript interfaces for all database entities

**src/lib/sync/:**
- Purpose: End-to-end encrypted sync engine
- Contains: Sync logic, types, API client
- Key files:
  - `src/lib/sync/SyncEngine.ts`: Core sync class with hooks, LWW conflict resolution
  - `src/lib/sync/types.ts`: Sync operation and provider types
  - `src/lib/sync/api.ts`: Sync API wrapper
  - `src/lib/sync/crypto-helpers.ts`: Encryption/decryption utilities

**src/components/ui/:**
- Purpose: Reusable Shadcn-style UI components
- Contains: Button, Input, Dialog, Select, Checkbox, Popover, etc.
- Pattern: Uses Radix UI primitives, Lucide icons, Tailwind styling

**src/hooks/:**
- Purpose: Global React hooks
- Contains: `useGlobalSync.ts`, `useTheme.ts`

**src/utils/:**
- Purpose: Shared utility functions
- Contains: Logger, class name merging, confirmation dialog, validation

## Key File Locations

**Entry Points:**
- `src/entrypoints/background.ts`: Background service worker
- `src/entrypoints/sidepanel/App.tsx`: Side panel root component
- `src/entrypoints/options/main.tsx`: Settings page entry
- `src/entrypoints/player/PlayerApp.tsx`: Recording playback

**Configuration:**
- `wxt.config.ts`: WXT extension configuration
- `tsconfig.json`: TypeScript config with `@/*` path alias
- `uno.config.ts`: UnoCSS styling configuration
- `eslint.config.js`: ESLint configuration

**Database:**
- `src/db/index.ts`: Dexie database initialization
- `src/db/types.ts`: Entity type definitions

**Sync:**
- `src/lib/sync/SyncEngine.ts`: Core sync engine (897 lines)
- `src/lib/globalSync.ts`: Global sync orchestration

**AI:**
- `src/lib/ai/index.ts`: AI initialization and tool registration
- `src/lib/ai/tools.ts`: Tool registry class
- `src/lib/ai/provider.ts`: Multi-provider AI support

**Feature Views:**
- `src/features/links/components/LinksView.tsx`: Links management UI
- `src/features/jenkins/components/JenkinsView.tsx`: Jenkins jobs/builds UI
- `src/features/blackboard/components/BlackboardView.tsx`: Blackboard UI
- `src/features/recorder/components/RecordingsView.tsx`: Recordings list (lazy loaded)
- `src/features/aiAssistant/components/AIAssistantView.tsx`: AI chat UI (lazy loaded)
- `src/features/toolbox/components/ToolboxView.tsx`: Development tools UI
- `src/features/hotNews/components/HotNewsView.tsx`: News feed UI

## Naming Conventions

**Files:**
- Components: `PascalCase.tsx` (e.g., `LinksView.tsx`, `JobTreeNode.tsx`)
- Utilities: `camelCase.ts` (e.g., `cn.ts`, `logger.ts`)
- Hooks: `camelCase.ts` with `use` prefix (e.g., `useLinks.ts`)
- Handlers: `camelCase.ts` (e.g., `jenkins.ts`, `sync.ts`)
- API clients: `camelCase.ts` (e.g., `fetchJobs.ts`, `build.ts`)
- Types: `PascalCase.ts` or `types.ts` per module

**Directories:**
- Features: `kebab-case` (e.g., `hotNews`, `aiAssistant`)
- Modules: `kebab-case` (e.g., `pageAgent`, `rrweb-plugins`)

**Functions/Variables:**
- React components: `PascalCase` (e.g., `LinksView`, `JenkinsView`)
- Hooks: `camelCase` with `use` prefix (e.g., `useLinks`, `useTheme`)
- Utilities: `camelCase` (e.g., `addLink`, `getAllActiveTags`)
- Types/Interfaces: `PascalCase` (e.g., `LinkItem`, `JenkinsCredentials`)

**Message Types:**
- Pattern: `FEATURE_ACTION` (uppercase with underscores)
- Examples: `JENKINS_FETCH_JOBS`, `RECORDER_START`, `SYNC_TRIGGER_PUSH`

## Where to Add New Code

**New Feature Module:**
1. Create `src/features/{feature-name}/`
2. Add `components/`, `hooks/`, `api/` subdirectories as needed
3. Create feature view component: `components/{FeatureName}View.tsx`
4. Add feature handler: `src/entrypoints/background/handlers/{feature}.ts`
5. Register handler in `src/entrypoints/background/handlers/index.ts`
6. Add route in `src/entrypoints/background.ts` message router

**New Database Entity:**
1. Add type to `src/db/types.ts`
2. Add table to schema in `src/db/index.ts` (new version if schema change)
3. Create CRUD operations in `src/lib/db/{entity}.ts`
4. Export from `src/lib/db/index.ts`

**New AI Tool:**
1. Create tool handler in `src/lib/ai/tools/{feature}.ts`
2. Export and call `register{Feature}Tools()` in `src/lib/ai/index.ts`

**New Background Handler:**
1. Create handler in `src/entrypoints/background/handlers/{name}.ts`
2. Export from `src/entrypoints/background/handlers/index.ts`
3. Add matcher to message router in `src/entrypoints/background.ts`

**New UI Component:**
1. Add to `src/components/ui/` following Shadcn patterns
2. Use Radix UI primitives, Lucide icons
3. Style with Tailwind via UnoCSS

## Special Directories

**src/lib/pageAgent/:**
- Purpose: Page agent injection and management
- Contains: `injector.ts` (tab tracking, injection), `types.ts`, `utils.ts`
- Generated: No
- Committed: Yes

**src/lib/rrweb-plugins/:**
- Purpose: Custom rrweb plugins for recording replay
- Contains: Console replay, network replay
- Generated: No
- Committed: Yes

**src/vendor/rrweb/:**
- Purpose: Third-party rrweb type declarations
- Generated: No
- Committed: Yes

**public/:**
- Purpose: Static assets (icons)
- Generated: No
- Committed: Yes

**packages/:**
- Purpose: Monorepo workspace packages
- Contains: `node-server/` (Express server), `cf-worker-googlesheet/` (Cloudflare worker)
- Generated: Build outputs
- Committed: Source only

---

*Structure analysis: 2026-03-26*
