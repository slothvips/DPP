# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

This project uses **pnpm**. Run commands from the repo root.

### Development
- `pnpm dev` - Start the Chrome development build
- `pnpm dev:firefox` - Start the Firefox development build
- `pnpm watch:build` - Rebuild on `src/**/*` changes

### Build
- `pnpm build` - Production build for Chrome
- `pnpm build:firefox` - Production build for Firefox
- `pnpm zip` - Package Chrome extension
- `pnpm zip:firefox` - Package Firefox extension

### Quality
- `pnpm compile` - TypeScript type check (`tsc --noEmit`)
- `pnpm lint` - Run ESLint
- `pnpm lint:fix` - Fix ESLint issues
- `pnpm format` - Run Prettier

### Testing
- There is currently **no formal test script** in `package.json`.
- Validation is mainly done with `pnpm compile`, `pnpm lint`, `pnpm build`, and manual / Chrome DevTools MCP testing.
- Interactive UI flows expose `data-testid` attributes. Keep them stable when changing user-facing controls.

### Git Hooks
- Pre-commit runs `pnpm lint-staged`.
- Staged `*.{js,jsx,ts,tsx}` files are auto-processed with `eslint --fix` and `prettier --write`.

## Project Overview

DPP is a sidepanel-first browser extension built with WXT + React 19. The product combines Jenkins workflows, links, blackboard notes, session recording, AI assistance, and automation tools in one extension UI.

Key constraints:
- Preserve compatibility across **light / dark / system** themes.
- Target **WCAG AA** contrast for text.
- Avoid breaking existing data or sync behavior.

## Architecture

### Mental model
- `src/entrypoints/sidepanel/App.tsx` is the main application shell. The extension is **not popup-first**.
- `src/entrypoints/background.ts` is the system bus. It wires side panel behavior, auto sync, omnibox, and message routing.
- Dexie (`src/db/index.ts`) is the shared local state core. UI, AI tools, and sync all work on the same data model.
- `src/lib/db/*` is the preferred business data access layer. Reuse it instead of duplicating table access logic.
- Sync is **selected-table sync**, not full-database sync.

### Main runtime flows

#### 1. Sidepanel shell
- `src/entrypoints/sidepanel/App.tsx` owns tab visibility, keep-alive rendering, feature toggles, Jenkins tab gating, and auto-pull on visibility.
- Large views such as AI Assistant and Recorder are lazy-loaded.

#### 2. Background message routing
- `src/entrypoints/background.ts` routes runtime messages by feature namespace / type.
- Handlers are registered through `src/entrypoints/background/handlers/index.ts`.
- New background-backed features should follow the existing handler pattern instead of adding ad-hoc logic to `background.ts`.

#### 3. Shared Dexie data layer
- `src/db/index.ts` defines the Dexie schema and initializes the sync engine.
- `src/lib/db/*` contains reusable CRUD logic shared by UI, background handlers, and AI tools.
- `useLiveQuery` is the default pattern for reactive reads in UI code.

#### 4. Sync engine
- `src/lib/sync/SyncEngine.ts` captures local CRUD through Dexie hooks and syncs encrypted operations.
- `src/db/index.ts` defines which tables participate in sync: currently `tags`, `jobTags`, `links`, `linkTags`, and `blackboard`.
- `src/lib/globalSync.ts` wraps three higher-level sync tasks: database sync, Jenkins refresh, and Hot News refresh.

#### 5. AI tools
- `src/lib/ai/tools.ts` provides the global tool registry.
- AI tools are adapters around existing product capabilities, usually reusing `src/lib/db/*` or background messages.
- When adding a mutating tool, require confirmation unless the existing AI flow explicitly handles it another way.

#### 6. PageAgent automation chain
PageAgent is a cross-context pipeline, not a standalone component:
- AI tool / UI triggers background message
- background handler injects the agent when needed
- `src/lib/pageAgent/injector.ts` manages injection lifecycle per tab
- `src/entrypoints/pageAgent.content.ts` initializes the in-page agent and proxies config / fetch through background
- `wxt.config.ts` exposes the injected script through `web_accessible_resources`

#### 7. Recorder pipeline
Recorder is another cross-context pipeline:
- UI starts recording
- background tracks recording state
- `src/entrypoints/recorder.content.ts` runs rrweb recording in the page
- `network-interceptor.ts` and `console-interceptor.ts` capture extra events from the page world
- results are stored locally and replayed through the player entrypoint

## Sync and data rules

### LWW conflict resolution
- Sync uses **Last Write Wins (LWW)**.
- Conflict resolution must use the **local client timestamp** (`updatedAt` / operation timestamp), not a server timestamp.
- When changing sync semantics, check both:
  - `src/lib/sync/types.ts`
  - `src/lib/sync/SyncEngine.ts`

### Hooks and transaction behavior
- Sync relies on Dexie lifecycle hooks. If you bypass Dexie CRUD, sync hooks will not fire.
- Operations originating from sync set `tx.source === 'sync'` to avoid feedback loops.
- Delete behavior for synced entities is implemented as **soft delete** via `deletedAt`, not direct removal.

### What syncs and what stays local
Synced and encrypted:
- Tags
- Links
- Link / job tag associations
- Blackboard items

Local only:
- Jenkins credentials
- Build history
- Most settings
- Recordings
- Local stats / caches

## Change together, not separately

These are the most important multi-file coupling rules in the repo.

### Database schema or entity changes
When changing schema or shared entity fields, review together:
- `src/db/types.ts`
- `src/db/index.ts`
- related `src/lib/db/*`
- related feature UI / hooks
- `src/lib/sync/SyncEngine.ts` if the table is synced

### Sync behavior changes
When changing sync behavior, review together:
- `src/lib/sync/types.ts`
- `src/lib/sync/SyncEngine.ts`
- `src/db/index.ts`
- relevant `src/lib/db/*`

### Deletion semantics
For synced entities, do not switch one code path to hard delete without checking the rest of the flow. Soft delete via `deletedAt` is part of the sync model.

### AI tool changes
When adding or changing AI tools, review together:
- `src/lib/ai/tools.ts`
- `src/lib/ai/index.ts`
- the specific `src/lib/ai/tools/*.ts`
- the reused `src/lib/db/*` or background handlers

### PageAgent changes
When changing PageAgent behavior, review together:
- `src/lib/ai/tools/pageAgent.ts`
- `src/entrypoints/background/handlers/pageAgent.ts`
- `src/lib/pageAgent/injector.ts`
- `src/entrypoints/pageAgent.content.ts`
- `src/entrypoints/background/handlers/general.ts`
- `wxt.config.ts`

### Recorder changes
When changing recording behavior, review together:
- `src/features/recorder/*`
- `src/entrypoints/background/handlers/recorder.ts`
- `src/entrypoints/recorder.content.ts`
- `src/entrypoints/network-interceptor.ts`
- `src/entrypoints/console-interceptor.ts`
- player-related entrypoints and recorder storage

### Feature tabs and toggles
If you add or rename a feature toggle or tab, review together:
- `src/entrypoints/sidepanel/App.tsx`
- options/settings UI
- settings types in the DB layer

## Coding conventions

Prefer the existing project conventions over generic patterns.

- Use **pnpm** only.
- Use the `@/` alias instead of parent-relative imports.
- Do not use `any`.
- Do not use `@ts-ignore` or `@ts-expect-error`.
- Prefer `function Component() {}` for React components.
- Avoid floating promises: `await` them or explicitly `void` them.
- Wrap async UI actions in `try/catch` when failures need logging or user feedback.
- Use `logger` for diagnostics and existing toast patterns for user-visible errors.
- Reuse `src/components/ui/*` primitives before introducing new UI patterns.
- Keep changes aligned with existing feature structure instead of introducing one-off abstractions.

## UI and accessibility notes

- Theme support must continue to work in light / dark / system mode.
- For muted text in dark mode, **do not** apply opacity modifiers on `muted-foreground`.
- Avoid patterns like:
  - `text-muted-foreground/70`
  - `text-muted-foreground/50`
  - `dark:text-muted-foreground/60`
- Use the base token directly to preserve WCAG-compliant contrast.

## WXT and manifest notes

- `wxt.config.ts` removes `action.default_popup` so clicking the extension action opens the side panel.
- The extension requires permissions including `storage`, `sidePanel`, `alarms`, `activeTab`, `scripting`, and `tabs`.
- `web_accessible_resources` includes recorder and PageAgent scripts. If you move or rename those assets, update the WXT config too.

## Practical guidance for future Claude instances

Before editing code:
1. Read the relevant feature entrypoint and its shared data helpers.
2. Check whether the behavior is implemented through background messages, shared DB helpers, or both.
3. If the change touches sync, recording, or PageAgent, assume there is at least one additional context or file that must change with it.
4. Prefer updating existing flows over adding parallel abstractions.
