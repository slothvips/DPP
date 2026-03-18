# DPP (WXT + React) Agent Guidelines

AI agents working on this codebase MUST follow these guidelines strictly.

## 1. Project Overview

| Stack       | Technology                               |
| ----------- | ---------------------------------------- |
| Framework   | WXT (Web Extension Tools) + React 19     |
| Language    | TypeScript (Strict)                      |
| Styling     | UnoCSS + Shadcn theme variables          |
| State/DB    | Dexie.js (IndexedDB) + dexie-react-hooks |
| Sync        | Custom SyncEngine + E2E Encryption       |
| Recording   | rrweb (Session Replay)                   |
| Pkg Manager | **pnpm** (NEVER use npm/yarn)            |

## 2. Critical Rules

- **No `any`**: Use `unknown` or specific types. ESLint errors on `any`.
- **No Suppressions**: Never use `@ts-ignore` or `@ts-expect-error`. Fix the underlying issue.
- **Unused Vars**: Prefix unused variables with `_` (e.g., `_req`) to satisfy linter.
- **No Relative Parent Imports**: Always use `@/` alias (e.g., `@/components/...`) instead of `../../`.
- **Strict Equality**: Always use `===` and `!==`.
- **Functional Components**: Use `function Name() {}` syntax, not arrow functions.
- **Async Safety**: Always `await` promises or explicitly void them. No floating promises.
- **Error Handling**: Use `try-catch` with `logger.error` and `toast` for user feedback.
- **React Compiler**: Uses babel-plugin-react-compiler. Avoid unstable hook deps, memoize expensive computations.
- **Production Safety**: Live product with users. Dexie schema changes require migration logic.

## 3. Commands

Run from project root. NEVER `cd` into subdirectories.

```bash
# Development
pnpm dev              # Chrome dev server
pnpm dev:firefox      # Firefox dev server
pnpm build            # Production build → .output/
pnpm build:firefox    # Firefox production build
pnpm zip              # Create Chrome zip distribution
pnpm zip:firefox      # Create Firefox zip distribution

# Quality Control (Run Before Committing)
pnpm compile          # Type check (tsc --noEmit) - MUST PASS
pnpm lint             # ESLint check
pnpm lint:fix         # Auto-fix lint issues
pnpm format           # Prettier format

# Testing (if tests are added)
pnpm vitest           # Run all tests
pnpm vitest run       # Run tests once (CI mode)
pnpm vitest run -- <file>   # Run single test file
pnpm vitest run -- -t "<test name>"  # Run single test by name
```

**Note:** This project currently has no test suite. If tests are needed, use Vitest.

## 4. Production Considerations

This is a live product with existing users:

- **Backward Compatibility**: Avoid breaking changes to APIs, data schemas, or features.
- **Database Migrations**: Dexie schema changes MUST include migration logic.
- **Data Loss Prevention**: Consider how changes affect existing user data.
- **Feature Flags**: Use flags for risky changes to allow gradual rollout.

## 5. Directory Structure

```
src/
├── entrypoints/         # WXT entry points (manifest inputs)
│   ├── background.ts    # Service worker (messaging hub)
│   ├── popup/           # Popup UI
│   └── *.content.ts     # Content scripts
├── components/ui/       # Shadcn-like primitives (Button, Input, Toast...)
├── features/            # Domain modules (jenkins/, links/, recorder/)
│   └── <feature>/{api/,components/,hooks/,messages.ts,types.ts}
├── db/                  # Dexie schema + Sync logic
├── lib/                 # Core utilities (crypto/, sync/)
└── utils/               # Helpers (cn.ts, logger.ts)
```

## 6. Code Style

### 6.1 Imports & Naming

- **Absolute Imports:** Always use `@/` alias (configured in tsconfig.json).
- **Import Order:** `react` → `wxt` → `@/...` → `./...` (Prettier handles sorting).
- **Naming Conventions:**
  - Components: `PascalCase.tsx`, `export function ComponentName`
  - Utils: `camelCase.ts`
  - Constants: `UPPER_SNAKE_CASE`

### 6.2 React Components

- Use `function Component() {}` syntax.
- Define Props interface. Pass `className` to root via `cn()`.
- Use `useLiveQuery` from `dexie-react-hooks` for reactive DB queries.
- Reuse UI primitives from `src/components/ui`.
- Use `useToast()` for user notifications.

```tsx
export function Badge({ variant = 'default', className, ...props }: BadgeProps) {
  return (
    <div
      className={cn('rounded px-2', variant === 'success' && 'bg-success', className)}
      {...props}
    />
  );
}
```

### 6.3 Error Handling

Always wrap async operations in try-catch. Use `logger` for logging and `toast` for user feedback.

```tsx
async function fetchData() {
  try {
    return await api.getData();
  } catch (err) {
    logger.error('Failed to fetch data', err);
    toast({ title: 'Error', description: 'Failed to fetch data' });
    throw err;
  }
}
```

### 6.4 Patterns

- **API Clients:** Factory pattern `createClient(credentials)`.
- **Sync:** Use `SyncEngine` class. Sensitive data MUST be encrypted before sync.
- **Styling:** UnoCSS utilities with Shadcn theme colors.
- **Logging:** Use `logger.info/warn/error` from `@/utils/logger`.
- **Classes:** Use `cn()` from `@/utils/cn` for conditional class merging.

## 7. Available Utilities

| Utility        | Location                | Purpose                |
| -------------- | ----------------------- | ---------------------- |
| `logger`       | `@/utils/logger`        | Debug/info/warn/error  |
| `cn`           | `@/utils/cn`            | Merge Tailwind classes |
| `useToast`     | `@/components/ui/toast` | User notifications     |
| `useLiveQuery` | `dexie-react-hooks`     | Reactive DB queries    |

## 8. Data & Synchronization

- **Dexie:** Define schema in `src/db/index.ts`. Handle versions carefully.
- **SyncEngine:** Handles data replication with E2EE via Web Crypto API.
- **Sensitive data** MUST be encrypted before storing or syncing.

## 9. Pre-commit Hooks

Uses `simple-git-hooks` with `lint-staged`. Before committing:

- ESLint auto-fixes applied
- Prettier formats changed files

Run `pnpm lint:fix` and `pnpm format` before committing.

## 10. Agent Workflow

1. **Analyze:** Read related files, check `src/components/ui` for reusable primitives.
2. **Plan:** Create TODO list, map out new files and schema changes.
3. **Implement:** Use `pnpm`, `cn()`, follow types strictly. Handle errors with try-catch + logger + toast.
4. **Verify:** `pnpm compile` (MUST PASS), `pnpm lint:fix`, `pnpm build`.
