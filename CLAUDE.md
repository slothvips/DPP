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

### Key Directories
- `src/entrypoints/` - Extension entry points (background, popup, options, content scripts).
- `src/features/` - Feature-based modules (jenkins, links, recorder, etc.).
- `src/lib/` - Shared utilities, including `sync/` and `crypto/`.
- `src/db/` - Database schema and configuration.
- `src/components/` - UI components (contains `ui/` for Shadcn).
- `src/hooks/` - Global React hooks.
- `src/config/` - Configuration constants.

## Code Style & Patterns

- **Components**: Functional components with hooks. Prefer `features/{name}/components/{Name}View.tsx` pattern for feature-specific UIs.
- **Database**: Use `useLiveQuery` for reactive data access from Dexie.
- **Message Passing**: Background script handles messages prefixed with feature namespaces (e.g., `JENKINS_*`, `RECORDER_*`).
- **Imports**: Uses `@/` alias for `src/` (configured in tsconfig/wxt).
- **Strict Mode**: TypeScript strict mode is enabled.
- **Git Hooks**: Pre-commit hooks run lint-staged (eslint --fix, prettier --write).
