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

### Security & Sync Model

- **E2EE**: All sync data is encrypted locally with user's key before upload. Server stores only encrypted blobs (blind storage).
- **NOT synced** (local only): Jenkins credentials, build history, settings, recordings, stats.
- **Synced**: Tags, Links, Link-Job tag associations (all encrypted).

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

## Automation Testing

This extension is designed for automation testing via Chrome DevTools MCP. All interactive elements have `data-testid` attributes for reliable selection.

### Extension Pages

- **Popup**: `chrome-extension://ojabcppnngnamjmnojnodjmabipbnpgi/popup.html`
- **Options**: `chrome-extension://ojabcppnngnamjmnojnodjmabipbnpgi/options.html`
- **Player**: `chrome-extension://ojabcppnngnamjmnojnodjmabipbnpgi/player.html`

### Test IDs Reference

#### Popup Page
| testid | Description |
|--------|-------------|
| `app-title` | Application title "DPP" |
| `settings-button` | Settings icon button |
| `tab-container` | Tab navigation container |
| `tab-blackboard` | Blackboard tab |
| `tab-jenkins` | Jenkins tab |
| `tab-links` | Links tab |
| `tab-recorder` | Recorder tab |
| `tab-hotnews` | Hot News tab |
| `main-content` | Main content area |

#### Options Page
| testid | Description |
|--------|-------------|
| `options-page` | Entire options page |
| `options-title` | Page title |
| `section-appearance` | Appearance section |
| `theme-toggle` | Theme toggle container |
| `theme-toggle-light` | Light theme button |
| `theme-toggle-dark` | Dark theme button |
| `theme-toggle-system` | System theme button |
| `checkbox-feature-hotnews` | Hot news feature toggle |
| `input-server-url` | Server URL input |
| `input-access-token` | Access token input |
| `button-save-sync` | Save sync settings button |
| `button-export` | Export config button |
| `button-import` | Import config button |
| `danger-zone` | Danger zone section |
| `button-clear-data` | Clear all data button |

#### Loading States
- `[data-testid="loading"]` - Shows during data fetch (e.g., BlackboardView)

### Testing Tips

1. Wait for loading to finish before assertions:
   ```javascript
   await wait_for('not([data-testid="loading"])')
   ```

2. Click elements by testid:
   ```javascript
   await click('[data-testid="settings-button"]')
   ```

3. Fill inputs by testid:
   ```javascript
   await fill('[data-testid="input-server-url"]', 'http://localhost:3000')
   ```
