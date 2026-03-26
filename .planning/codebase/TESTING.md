# Testing Patterns

**Analysis Date:** 2026-03-26

## Test Framework

**Status:** No unit test framework configured

This codebase does not have a traditional unit testing framework (Jest, Vitest, etc.) set up. Testing is done through:
- TypeScript compilation checking (`pnpm compile`)
- ESLint linting (`pnpm lint`)
- Prettier formatting (`pnpm format`)
- Manual testing via Chrome DevTools MCP

**Type Checking:**
```bash
pnpm compile    # Run tsc --noEmit for type checking
```

**Linting:**
```bash
pnpm lint       # Run ESLint
pnpm lint:fix  # Fix linting issues automatically
```

**Formatting:**
```bash
pnpm format    # Format code with Prettier
```

## Test File Organization

**Location:** Not applicable

No test files exist in the `src/` directory. All test patterns are for manual/automation testing.

## Test ID Based Testing

The extension is designed for automation testing via Chrome DevTools MCP with `data-testid` attributes.

**Running Tests:**
```bash
pnpm dev  # Start dev server for Chrome
```

Then use Chrome DevTools MCP to interact with the extension.

## Test IDs Reference

### Side Panel

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
| `tab-ai-assistant` | AI Assistant tab |
| `tab-toolbox` | Toolbox tab |
| `toolbox-view` | Toolbox main view |
| `main-content` | Main content area |

### Options Page

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

### Loading States

| testid | Description |
|--------|-------------|
| `loading` | Shows during data fetch (e.g., BlackboardView) |

## Testing Tips

**Wait for Loading:**
```javascript
await wait_for('not([data-testid="loading"])');
```

**Click Elements:**
```javascript
await click('[data-testid="settings-button"]');
```

**Fill Inputs:**
```javascript
await fill('[data-testid="input-server-url"]', 'http://localhost:3000');
```

## Code Quality Assurance

### Pre-commit Hooks

Git hooks via `simple-git-hooks` with `lint-staged`:

```bash
# .git/hooks are managed via simple-git-hooks
# Pre-commit runs: pnpm lint-staged
```

**lint-staged Configuration (package.json):**
```json
{
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ]
  }
}
```

### Type Safety

- TypeScript strict mode enabled
- No `any` type allowed (enforced by ESLint)
- Unused variables trigger warnings

### ESLint Rules

From `eslint.config.js`:
- `react-hooks/rules-of-hooks`: error
- `react-hooks/exhaustive-deps`: warn
- `@typescript-eslint/no-unused-vars`: warn (with `_` ignore pattern)
- `@typescript-eslint/no-explicit-any`: error

## What Is NOT Tested

The following are NOT covered by automated tests:
- Database operations (Dexie/IndexedDB)
- Sync engine operations
- AI tool handlers
- Background message handlers
- React component rendering
- UI interactions

## Manual Testing Workflow

1. Run `pnpm dev` to start the development server
2. Open Chrome and load the extension
3. Use the side panel to navigate features
4. Use Chrome DevTools console for logging
5. Inspect network requests via DevTools Network tab

## Coverage

**Type Coverage:** 100% (TypeScript with strict mode)

**Runtime Coverage:** Manual only

---

*Testing analysis: 2026-03-26*
