# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

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
- `src/features/` - Feature-based modules (jenkins, links, recorder, etc.).
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
- `diff/index.html` + `diff/main.tsx` - Standalone diff tool

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
