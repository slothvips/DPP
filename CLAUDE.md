# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DPP is a browser extension built with WXT + React 19 that provides team documentation management, Jenkins deployment assistance, and screen recording capabilities. It uses end-to-end encryption (E2EE) for multi-device sync.

## Commands

```bash
# Development
pnpm dev              # Start dev server for Chrome
pnpm dev:firefox      # Start dev server for Firefox

# Build
pnpm build            # Production build for Chrome
pnpm build:firefox    # Production build for Firefox
pnpm zip              # Package extension for distribution

# Quality
pnpm lint             # Run ESLint
pnpm lint:fix         # Fix linting issues
pnpm compile          # TypeScript type checking (tsc --noEmit)

# Testing
pnpm test             # Run Vitest in watch mode
pnpm test:coverage    # Run tests with coverage
```

## Architecture

### WXT Extension Structure

Source is in `src/` (configured via `wxt.config.ts`). Key entrypoints:

- `src/entrypoints/background.ts` - Service worker handling Jenkins API, sync, and recording coordination
- `src/entrypoints/popup/` - Main extension popup UI with tabbed views
- `src/entrypoints/options/` - Settings page
- `src/entrypoints/jenkins.content.ts` - Content script for Jenkins pages
- `src/entrypoints/recorder.content.ts` - rrweb-based screen recording injection
- `src/entrypoints/offscreen/` - Offscreen document for screen capture API
- `src/entrypoints/player/` - rrweb playback viewer

### Feature Modules

Features are organized under `src/features/`:

- `jenkins/` - Job listing, build triggering, multi-environment support
- `links/` - Team link management with tags
- `recorder/` - Screen recording using rrweb
- `hotNews/` - Tech news aggregation
- `tags/` - Shared tagging system
- `settings/` - Configuration management

### Data Layer

- **Database**: Dexie.js wrapper over IndexedDB (`src/db/index.ts`)
- **Schema versions**: 17 versions with migrations for tags, jobs, builds, recordings
- **Synced tables**: `tags`, `jobTags`, `links`, `linkTags` (E2EE encrypted)
- **Local-only**: Jenkins credentials, build history, recordings, settings

### Sync System

Custom `SyncEngine` (`src/lib/sync/SyncEngine.ts`) provides:
- Operation-based sync with Dexie table hooks
- Push/pull with cursor-based pagination
- Conflict resolution via timestamp comparison
- E2EE via Web Crypto API (`src/lib/crypto/encryption.ts`)

### UI Components

- Shadcn-style components in `src/components/ui/`
- UnoCSS for styling (configured in `wxt.config.ts`)
- Theme support via `useTheme` hook

### Message Passing

Background script handles messages prefixed with:
- `JENKINS_*` - Jenkins API operations
- `RECORDER_*` - Recording lifecycle
- `GLOBAL_SYNC_*` - Sync triggers

## Key Patterns

- Use `useLiveQuery` from dexie-react-hooks for reactive database queries
- Feature components follow pattern: `features/{name}/components/{Name}View.tsx`
- API clients in `features/{name}/api/`
- Background operations return `{ success: boolean, data?, error? }`
