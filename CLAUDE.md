# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

This project uses **pnpm** as the package manager.

- **Development**:
  - `pnpm dev` - Start dev server for Chrome
  - `pnpm dev:firefox` - Start dev server for Firefox
  - `pnpm compile` - Type check with TypeScript (tsc --noEmit)
  - `pnpm watch:build` - Watch mode for builds

- **Build**:
  - `pnpm build` - Production build for Chrome
  - `pnpm build:firefox` - Production build for Firefox
  - `pnpm zip` / `pnpm zip:firefox` - Package extension for distribution

- **Testing & Quality**:
  - `pnpm lint` - Run ESLint
  - `pnpm lint:fix` - Fix linting issues
  - `pnpm format` - Format code with Prettier

## Architecture

- **Structure**: PNPM workspace monorepo (root extension + packages).
- **Framework**: WXT (Web Extension Tools) + React 19 + TypeScript.
- **State/Storage**: Dexie.js (IndexedDB) with `dexie-react-hooks` for reactive queries.
- **Styling**: UnoCSS + Shadcn UI components (Tailwind-compatible).
- **Sync**: Custom `SyncEngine` implementing E2EE via Web Crypto API.
- **Recording**: Uses `rrweb` for session recording and replay.
- **AI Assistant**: Multi-provider support (Ollama, WebLLM, Anthropic, OpenAI-compatible).

### Sync LWW Strategy

The sync engine uses **Last Write Wins (LWW)** strategy for conflict resolution. When modifying sync-related code, always update ALL of the following locations to maintain consistency:

1. **Type definition**: `src/lib/sync/types.ts` - field comments
2. **Conflict resolution logic**: `src/lib/sync/SyncEngine.ts`
   - Line ~509: `op.timestamp` for comparing incoming operations
   - Line ~574: `getRecordTimestamp()` returns local `updatedAt`

**Principle**: Always use local client timestamp for LWW conflict resolution. Do NOT use `serverTimestamp` for conflict resolution.

### Sync Engine Hooks & Transaction Pattern

The SyncEngine uses Dexie lifecycle hooks to capture database changes:

- **Transaction source check**: All hooks check `tx.source === 'sync'` to skip operations initiated by sync itself, preventing infinite loops
- **`creating` hook**: Records `updatedAt` timestamp and queues sync operation via `onsuccess` callback with `queueMicrotask`
- **`updating` hook**: Merges `updatedAt` into modifications, queues sync via `queueMicrotask`
- **`deleting` hook**: For soft-delete, intercepts the delete operation, uses `queueMicrotask` to re-put the record with `deletedAt` set, then returns `false` to prevent actual deletion

**Important**: When adding database operations that should trigger sync:
1. Ensure the operation goes through Dexie's normal CRUD API (not bypassing hooks)
2. If using transactions, DO NOT set `source: 'sync'` unless the operation comes FROM a sync operation
3. Use `db.transaction('rw', db.table, ...)` to batch multiple operations atomically

### Security & Sync Model

- **E2EE**: All sync data is encrypted locally with user's key before upload. Server stores only encrypted blobs (blind storage).
- **NOT synced** (local only): Jenkins credentials, build history, settings, recordings, stats.
- **Synced**: Tags, Links, Link-Job tag associations, Blackboard items (all encrypted).

### Background Message Routing

Background script uses a strategy pattern for message handling. Handlers are in `src/entrypoints/background/handlers/`:

- Message types are prefixed with feature namespaces: `JENKINS_*`, `RECORDER_*`, `SYNC_*`, `PROXY_*`
- Each handler module exports a `handle*Message` function
- New features should follow this pattern: create handler module, add to `handlers/index.ts`, register in `background.ts`

### AI Tools Architecture

AI tools integrate with the database through `src/lib/db/` module:

1. **Tool Registry** (`src/lib/ai/tools.ts`): Global registry for all AI tools with `register()`, `execute()`, and confirmation support
2. **Tool Registration** (`src/lib/ai/tools/*.ts`): Each feature registers tools (e.g., `registerLinksTools()`)
3. **DB Operations** (`src/lib/db/*.ts`): Unified CRUD functions used by both AI tools and UI components

When adding new AI tools:

1. Create handler functions that call `src/lib/db/` operations
2. Register tools with `toolRegistry.register()` in a `register*Tools()` function
3. Call the registration function in `src/lib/ai/index.ts`
4. Tools that modify data should set `requiresConfirmation: true`

### Page Agent Integration

The extension uses `page-agent` library for in-page automation:

- Content script: `src/entrypoints/pageAgent.content.ts`
- Handler: `src/entrypoints/background/handlers/pageAgent.ts`
- Types: `src/lib/pageAgent/types.ts`
- Background injects the agent on demand via `PAGE_AGENT_INJECT` message

### Key Directories

- `src/entrypoints/` - Extension entry points (background, popup, options, content scripts, sidepanel).
- `src/features/` - Feature-based modules (jenkins, links, recorder, toolbox, etc.).
- `src/lib/` - Shared utilities, including `sync/`, `crypto/`, `ai/`, `db/`.
- `src/lib/db/` - Unified database CRUD operations (links, tags, blackboard, etc.).
- `src/db/` - Database schema (Dexie) and type definitions.
- `src/components/` - UI components (contains `ui/` for Shadcn).
- `src/hooks/` - Global React hooks.
- `src/config/` - Configuration constants.

### Extension Entrypoints

The extension uses WXT with multiple entrypoints:

- `background.ts` - Service worker handling message routing via strategy pattern
- `sidepanel/App.tsx` - Side panel UI with tab-based navigation and keep-alive pattern
- `options/main.tsx` - Options/settings page
- `popup/App.tsx` - Browser action popup
- `player/PlayerApp.tsx` - Recording playback page
- `debug/main.tsx` - Debug utility page

### Recorder & rrweb Integration

Session recording uses `rrweb` with custom interceptors:

- `console-interceptor.ts` - Captures console.log/info/warn/error events
- `network-interceptor.ts` - Captures network requests via fetch/XHR override
- `recorder.content.ts` - Content script injected to record page events
- Replay uses `ConsolePanel` and `NetworkPanel` components in the recorder feature

## Change Principle

When making any code change, always check for **related modifications** that need to be done together to ensure completeness:

- **Comments**: Update outdated comments that describe the changed code
- **Type definitions**: Update field comments when logic changes
- **Documentation**: Update related docs if they exist
- **Tests**: Check if test expectations need updates
- **Related files**: Check files that depend on or reference the changed code

This ensures changes are complete and prevents future misunderstandings.

## Code Style & Patterns

- **Components**: Functional components with hooks. Prefer `features/{name}/components/{Name}View.tsx` pattern for feature-specific UIs.
- **Database**: Use `useLiveQuery` from `dexie-react-hooks` for reactive data access.
- **Unified DB Operations**: Use `src/lib/db/` for all database CRUD operations. This module provides unified functions used by both AI tools and UI components.
- **Imports**: Uses `@/` alias for `src/` (configured in tsconfig/wxt).
- **Strict Mode**: TypeScript strict mode is enabled.
- **Git Hooks**: Pre-commit hooks run lint-staged (eslint --fix, prettier --write).
- **Lazy Loading**: Large components (AIAssistantView, RecordingsView) use React.lazy for code splitting.

## Automation Testing

This extension is designed for automation testing via Chrome DevTools MCP. All interactive elements have `data-testid` attributes for reliable selection.

### Running Tests

```bash
# Run dev server and use Chrome DevTools MCP to interact with the extension
pnpm dev
```

### Test IDs Reference

#### Side Panel

| testid             | Description              |
| ------------------ | ------------------------ |
| `app-title`        | Application title "DPP"  |
| `settings-button`  | Settings icon button     |
| `tab-container`    | Tab navigation container |
| `tab-blackboard`   | Blackboard tab           |
| `tab-jenkins`      | Jenkins tab              |
| `tab-links`        | Links tab                |
| `tab-recorder`     | Recorder tab             |
| `tab-hotnews`      | Hot News tab             |
| `tab-ai-assistant` | AI Assistant tab         |
| `tab-toolbox`      | Toolbox tab              |
| `toolbox-view`     | Toolbox main view        |
| `main-content`     | Main content area        |

#### Options Page

| testid                     | Description               |
| -------------------------- | ------------------------- |
| `options-page`             | Entire options page       |
| `options-title`            | Page title                |
| `section-appearance`       | Appearance section        |
| `theme-toggle`             | Theme toggle container    |
| `theme-toggle-light`       | Light theme button        |
| `theme-toggle-dark`        | Dark theme button         |
| `theme-toggle-system`      | System theme button       |
| `checkbox-feature-hotnews` | Hot news feature toggle   |
| `input-server-url`         | Server URL input          |
| `input-access-token`       | Access token input        |
| `button-save-sync`         | Save sync settings button |
| `button-export`            | Export config button      |
| `button-import`            | Import config button      |
| `danger-zone`              | Danger zone section       |
| `button-clear-data`        | Clear all data button     |

#### Loading States

- `[data-testid="loading"]` - Shows during data fetch (e.g., BlackboardView)

### Testing Tips

1. Wait for loading to finish before assertions:

   ```javascript
   await wait_for('not([data-testid="loading"])');
   ```

2. Click elements by testid:

   ```javascript
   await click('[data-testid="settings-button"]');
   ```

3. Fill inputs by testid:
   ```javascript
   await fill('[data-testid="input-server-url"]', 'http://localhost:3000');
   ```

<!-- GSD:project-start source:PROJECT.md -->
## Project

**DPP (Developer Productivity Platform)**

A browser extension (Chrome/Firefox) that enhances developer workflow through Jenkins integration, session recording, AI assistance, and productivity tools. Built with WXT + React 19, using IndexedDB for local storage and E2EE sync.

**Core Value:** **Make developers more productive** — unify Jenkins workflows, session recording, and AI assistance in one accessible side panel.

### Constraints

- **Tech Stack**: WXT, React 19, TypeScript, UnoCSS — cannot change
- **Theme Compatibility**: Must maintain all three theme modes (light/dark/system)
- **WCAG Standards**: Target AA contrast ratio (4.5:1 normal text, 3:1 large text)
- **No Breaking Changes**: Existing functionality must remain intact
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript 5.9.3 - All extension code, server code, and packages
- CSS/UnoCSS - Styling via utility-first approach
## Runtime
- Chrome/Firefox browser extensions (WXT framework)
- Node.js 20+ (for node-server package)
- pnpm 10.33.0
- Lockfile: `pnpm-lock.yaml` (present)
## Frameworks
- WXT 0.20.6 - Web Extension Tools framework (Chrome/Firefox)
- React 19.2.3 - UI framework
- React DOM 19.2.3 - DOM rendering
- Vite (via WXT) - Build tool
- UnoCSS 66.6.0 - Atomic CSS engine
- Babel 7.28.5 (via vite-plugin-babel) - TypeScript transpilation with React Compiler
- Babel Plugin React Compiler 1.0.0 - React 19 optimization
- No formal test framework detected (manual testing via Chrome DevTools MCP)
- Dexie 4.2.1 - IndexedDB wrapper
- dexie-react-hooks 4.2.0 - React hooks for Dexie
- Radix UI (multiple packages) - Headless UI primitives
- class-variance-authority 0.7.1 - Component variant styling
- clsx 2.1.1 - Conditional classNames
- tailwind-merge 3.4.0 - Tailwind class merging
- Monaco Editor 0.55.1 - VS Code's editor component
- @codingame/monaco-vscode-multi-diff-editor-service-override 28.3.1
- rrweb 2.0.0-alpha.20 - Session recording and replay
- @rrweb/packer 2.0.0-alpha.20
- @rrweb/types 2.0.0-alpha.20
- page-agent 1.6.1 - In-page automation agent
## Key Dependencies
- react 19.2.3 - UI rendering
- dexie 4.2.1 - Local database (IndexedDB)
- wxt 0.20.6 - Extension framework
- lodash-es 4.17.23 - Utility functions
- date-fns 4.1.0 - Date manipulation
- diff 8.0.3 - Diff algorithm
- lucide-react 0.563.0 - Icons
- react-markdown 10.1.0 - Markdown rendering
- remark-gfm 4.0.1 - GitHub Flavored Markdown
- allotment 1.20.5 - Split panes
- masonry-layout 4.2.2 - Masonry layout
- @tanstack/react-virtual 3.13.21 - Virtual scrolling
- react-diff-viewer-continued 4.2.0 - Diff viewer component
## Configuration
- `tsconfig.json` extends `.wxt/tsconfig.json`
- Path alias: `@/*` maps to `src/*`
- Strict mode enabled
- `eslint.config.js` uses typescript-eslint
- React Hooks rules enforced
- No explicit-any is error
- Prettier integration via eslint-config-prettier
- `uno.config.ts` - UnoCSS configuration
- Presets: preset-uno, preset-icons
- `wxt.config.ts` - Extension configuration
- Manifest V3 permissions: storage, sidePanel, alarms, activeTab, scripting, tabs
- Host permissions: `<all_urls>`
- Chunk size warning limit: 7000KB (increased from default)
- Development mode adds "(DEV)" suffix to extension name
## Platform Requirements
- Node.js 20+
- pnpm 10+
- Chrome or Firefox browser for testing
- Chrome 88+ or Firefox 78+
- Manifest V3 support
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- PascalCase for components: `LinksView.tsx`, `BlackboardView.tsx`, `ErrorBoundary.tsx`
- camelCase for utilities/hooks: `useLinks.ts`, `useTheme.ts`, `cn.ts`, `logger.ts`
- kebab-case for directories: `links/`, `blackboard/`, `aiAssistant/`
- Index files for barrel exports: `index.ts`, `index.tsx`
- camelCase: `addLink()`, `updateLink()`, `resolveTagNamesToIds()`
- use-prefix for React hooks: `useLinks()`, `useTheme()`, `useAIChat()`
- handle-prefix for message handlers: `handleJenkinsMessage()`, `handleSyncMessage()`
- get-prefix for getters: `getLink()`, `getClientId()`, `getSettingByKey()`
- camelCase: `existingLink`, `tagIds`, `filteredLinks`
- PascalCase for React components and types: `LinkItem`, `TagItem`, `Theme`
- SCREAMING_SNAKE_CASE for constants: `PREFIX`, `YOLO_MODE_KEY`, `PUSH_BATCH_SIZE`
- PascalCase with descriptive suffixes: `LinkItem`, `LinkTagItem`, `SyncOperation`
- Interface names without "I" prefix: `AIToolMetadata`, not `IAIToolMetadata`
- Type aliases for unions: `Theme = 'light' | 'dark' | 'system'`
## Code Style
- Tool: Prettier with `@trivago/prettier-plugin-sort-imports`
- Settings: `package.json` at project root
- Import order: `^react`, `^wxt`, `^@`, `^[./]` (react first, then wxt, then @ aliases, then relative)
- Tool: ESLint with `typescript-eslint` and `eslint-plugin-react-hooks`
- Config: `eslint.config.js` at project root
- Key rules enforced:
- Pre-commit: `lint-staged` runs `eslint --fix` and `prettier --write`
- Simple-git-hooks configured in `package.json`
## Import Organization
- `@/*` maps to `src/*` (configured in `tsconfig.json`)
- Example: `import { db } from '@/db'`, `import { logger } from '@/utils/logger'`
- Feature modules use `index.ts` for exports: `src/features/links/hooks/index.ts`
- Handler modules export from `index.ts`: `src/entrypoints/background/handlers/index.ts`
## Error Handling
## Logging
- Prefix: `[DPP]`
- Dev-only debug: `if (level === 'debug' && !isDev) return;`
- Console method mapping: debug -> log, info/warn/error -> respective methods
## Comments
- JSDoc for public functions: `/** Validate URL format */`
- Type documentation: `@param`, `@returns`
- Complex business logic explanations
- Chinese comments for user-facing strings
## Function Design
- Use objects for functions with multiple args:
- Destructure with defaults: `const page = args.page ?? 1;`
- Consistent return objects: `{ success: boolean; message: string }`
- Nullable returns: `Promise<LinkItem | null>`
- Async/await preferred over raw promises
## Module Design
- Named exports preferred
- Barrel files for feature modules
- Type exports alongside implementation
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- **Extension Framework**: WXT (Web Extension Tools) provides the build system and entrypoint management
- **UI Framework**: React 19 with TypeScript, using functional components with hooks
- **Database**: Dexie.js (IndexedDB wrapper) with reactive queries via `dexie-react-hooks`
- **State**: Reactive database queries as the primary state mechanism
- **Sync**: Custom E2EE sync engine using Web Crypto API with Last Write Wins (LWW) conflict resolution
- **AI**: Multi-provider AI integration (Ollama, WebLLM, Anthropic, OpenAI-compatible) with tool registry pattern
- **Message Routing**: Strategy pattern in background script for handling extension messages
## Layers
- Purpose: Browser extension entry points
- Location: `src/entrypoints/`
- Contains: Background service worker, side panel, options page, popup, content scripts, player
- Depends on: Features, lib modules
- Used by: Browser extension runtime
- Purpose: Feature-specific business logic and UI
- Location: `src/features/{feature}/`
- Contains: Components, hooks, API clients, types, utilities
- Sub-modules:
- Depends on: lib modules, components, db
- Used by: Entrypoints, other features
- Purpose: Cross-cutting functionality used by multiple features
- Location: `src/lib/`
- Contains: `ai/`, `db/`, `sync/`, `crypto/`, `pageAgent/`, `rrweb-plugins/`, `http.ts`
- Key modules:
- Depends on: db, types
- Used by: Features, entrypoints, background handlers
- Purpose: Schema definition and database instance
- Location: `src/db/`, `src/db/index.ts`
- Contains: Dexie database instance, type definitions
- Depends on: Dexie
- Used by: lib/db operations, features
- Purpose: Reusable UI primitives
- Location: `src/components/`
- Contains: `ui/` (shadcn components), shared components
- Depends on: UI library (shadcn/ui, UnoCSS)
- Used by: Features
- Purpose: Global React hooks
- Location: `src/hooks/`
- Contains: `useTheme.ts`, `useGlobalSync.ts`
- Depends on: db, sync engine
- Used by: Entrypoints
- Purpose: Constants and configuration
- Location: `src/config/`, `src/config/constants.ts`
- Contains: Feature flags, API endpoints, constants
- Used by: Throughout codebase
- Purpose: General utilities
- Location: `src/utils/`
- Contains: `cn.ts` (classname utility), `logger.ts`, `modal.ts`, `validation.ts`, `confirm-dialog.tsx`, `base64.ts`
- Used by: Throughout codebase
## Data Flow
## Key Abstractions
- Purpose: Unified Jenkins API client for all features
- Examples: `src/features/jenkins/service.ts`
- Pattern: Service that sends typed messages to background handlers
- Purpose: Global registry for AI tools
- Examples: `src/lib/ai/tools.ts`
- Pattern: Singleton registry with `register()`, `execute()`, `requiresConfirmation()`
- Purpose: E2EE sync with LWW conflict resolution
- Examples: `src/lib/sync/SyncEngine.ts`
- Pattern: Class with hooks, event emitters, and sync lock
- Purpose: Unified data access layer
- Examples: `src/lib/db/links.ts`, `src/lib/db/tags.ts`, `src/lib/db/blackboard.ts`
- Pattern: Functional API with transactions, soft-delete support
- Purpose: Message handling for background script
- Examples: `src/entrypoints/background/handlers/jenkins.ts`, `src/entrypoints/background/handlers/sync.ts`
- Pattern: Module exports `handle*Message()` function, registered in `handlers/index.ts`
## Entry Points
- Location: `src/entrypoints/background.ts`
- Triggers: Extension install/update, browser startup, alarm events, network events
- Responsibilities: Message routing, auto-sync setup, omnibox setup, side panel behavior
- Location: `src/entrypoints/sidepanel/App.tsx`
- Triggers: User clicks side panel icon
- Responsibilities: Tab-based navigation, lazy-loaded feature views, theme management, auto-pull sync
- Location: `src/entrypoints/options/main.tsx`
- Triggers: User opens extension options
- Responsibilities: Settings management, sync key management, Jenkins env management
- Location: `src/entrypoints/popup/App.tsx` (referenced but structure shown in sidepanel pattern)
- Triggers: User clicks browser action
- Location: `src/entrypoints/recorder.content.ts`, `src/entrypoints/jenkins.content.ts`, `src/entrypoints/zentao.content.tsx`, `src/entrypoints/pageAgent.content.ts`
- Triggers: Page load on configured URLs
- Responsibilities: Page-specific recording, Jenkins integration, PageAgent injection
- Location: `src/entrypoints/player/PlayerApp.tsx`
- Triggers: Opening recording playback
- Responsibilities: rrweb replay with custom plugins
- Location: `src/entrypoints/debug/main.tsx`, `src/entrypoints/changelog/main.tsx`, `src/entrypoints/diff/main.tsx`, `src/entrypoints/tree-diff/main.tsx`
- Triggers: Direct URL access
- Responsibilities: Debug tools, changelog, data diff tools
## Error Handling
- Background handlers return `JenkinsResponse | { success: false, error: string }`
- Service layer wraps errors in descriptive messages
- UI components use `useToast` for error display
- Sync engine emits `sync-error` events for global error handling
- Custom `logger` utility (`src/utils/logger.ts`)
- Structured logging with context
- Service worker and background contexts use different logging transports
## Cross-Cutting Concerns
- URL validation in `lib/db/links.ts` via `isValidUrl()`
- Tag name resolution with case-insensitive matching
- Environment variable validation for Jenkins credentials
- Jenkins credentials stored encrypted in IndexedDB
- Sync uses access tokens and E2EE
- AI providers use API keys or local models
- React `ErrorBoundary` component at `src/components/ErrorBoundary.tsx`
- Graceful degradation for component errors
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
