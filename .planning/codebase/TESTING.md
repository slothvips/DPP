# Testing Patterns

**Analysis Date:** 2026-03-27

## Test Framework

**Status:** Not configured

This codebase does NOT have a unit testing framework configured. There are:
- No `jest.config.*` or `vitest.config.*` files
- No `.test.ts` or `.spec.ts` files in `src/`
- No test scripts in `package.json`

## Testing Approach

**Primary Testing Method:** Manual testing via Chrome DevTools MCP

The extension is designed for automation testing via Chrome DevTools MCP (Model Context Protocol). All interactive elements have `data-testid` attributes for reliable selection.

**Running Tests:**
```bash
pnpm dev              # Start dev server for Chrome
pnpm dev:firefox      # Start dev server for Firefox
# Then use Chrome DevTools MCP to interact with the extension
```

## Test ID Reference

The codebase uses `data-testid` attributes for element selection. Reference from `CLAUDE.md`:

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

## Test File Organization

**Location:** N/A - No test files exist in `src/`

**Expected pattern if tests were added:**
```
src/
  features/
    links/
      __tests__/
        useLinks.test.ts
        LinksView.test.tsx
  lib/
    db/
      __tests__/
        links.test.ts
```

## Mocking

**Framework:** N/A - No testing framework

**If testing were to be added, mocking approach would likely:**
- Use `vi.mock()` for module mocking (if using Vitest)
- Mock Dexie/database operations
- Mock browser APIs via `wxt/browser`

**Current manual testing considerations:**
- Real database operations (Dexie/IndexedDB)
- Real browser extension APIs
- Test data must be created manually or via UI

## Coverage

**Requirements:** None enforced

**No coverage tools configured.** If testing were to be added:
```bash
# Would likely be (if using Vitest)
vitest run --coverage
```

## Common Patterns for Future Testing

**Async Testing:**
```typescript
// Pattern used in codebase for async operations
async function handleSave(data: SaveData) {
  try {
    await saveToDb(data);
    toast('保存成功', 'success');
  } catch (error) {
    logger.error('Failed to save:', error);
    toast('保存失败', 'error');
  }
}
```

**Error Testing:**
```typescript
// Pattern for testing error cases
if (!existingLink) {
  throw new Error(`链接不存在或已被删除`);
}
```

**State Testing (via useLiveQuery):**
```typescript
// Pattern for reactive data
const links = useLiveQuery(() => db.links.filter((l) => !l.deletedAt).toArray());
```

## Quality Commands

```bash
pnpm lint              # Run ESLint
pnpm lint:fix          # Fix linting issues
pnpm format            # Format code with Prettier
pnpm compile           # Type check with TypeScript (tsc --noEmit)
```

---

*Testing analysis: 2026-03-27*
