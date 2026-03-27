# Testing Patterns

**Analysis Date:** 2026-03-27

## Test Framework

**No formal test framework detected in this project.**

The project uses:
- **Manual testing via Chrome DevTools MCP** - See CLAUDE.md for details
- **Browser extension testing** - `pnpm dev` to run dev server
- **No Jest, Vitest, or other test runners configured**

## Project Testing Approach

### Manual Testing with data-testid

The extension is designed for automation testing via Chrome DevTools MCP. All interactive elements have `data-testid` attributes.

**Run dev server:**
```bash
pnpm dev              # Chrome
pnpm dev:firefox      # Firefox
```

### Test ID Reference (from CLAUDE.md)

#### Side Panel
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
- `[data-testid="loading"]` - Shows during data fetch

### Testing Tips

1. Wait for loading to finish:
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

## Code Quality Commands

```bash
pnpm lint              # Run ESLint
pnpm lint:fix          # Fix linting issues
pnpm format            # Format code with Prettier
pnpm compile           # Type check with TypeScript (tsc --noEmit)
```

## Future Testing Considerations

The codebase currently lacks:
- **Unit tests** - No Jest/Vitest configuration
- **Integration tests** - No test infrastructure
- **E2E tests** - Manual testing only
- **Mocking frameworks** - No mocking library configured

If adding tests in the future, consider:
- Vitest (compatible with Vite/WXT)
- React Testing Library for component tests
- Mocking Dexie database operations for unit tests

---

*Testing analysis: 2026-03-27*
