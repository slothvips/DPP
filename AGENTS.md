# DPP (WXT + React) Agent Guidelines

AI agents working on this codebase MUST follow these guidelines strictly.

## Project Overview

| Stack       | Technology                               |
| ----------- | ---------------------------------------- |
| Framework   | WXT (Web Extension Tools) + React 19     |
| Language    | TypeScript (Strict)                      |
| Styling     | UnoCSS + Shadcn theme variables          |
| State/DB    | Dexie.js (IndexedDB) + dexie-react-hooks |
| Sync        | Custom SyncEngine + E2E Encryption       |
| Recording   | rrweb (Session Replay)                   |
| Pkg Manager | **pnpm** (NEVER use npm/yarn)            |

## Critical Rules

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

## Commands

Run from project root. NEVER `cd` into subdirectories.

```bash
# Development
pnpm dev              # Chrome dev server
pnpm dev:firefox      # Firefox dev server

# Production
pnpm build            # Production build → .output/
pnpm build:firefox    # Firefox production build
pnpm zip              # Create Chrome zip distribution
pnpm zip:firefox      # Create Firefox zip distribution

# Quality Control (Run Before Committing)
pnpm compile          # Type check (tsc --noEmit) - MUST PASS
pnpm lint             # ESLint check
pnpm lint:fix         # Auto-fix lint issues
pnpm format           # Prettier format
```

## Production Considerations

This is a live product with existing users:

- **Backward Compatibility**: Avoid breaking changes to APIs, data schemas, or features.
- **Database Migrations**: Dexie schema changes in `src/db/schema.ts` MUST include migration logic.
- **Data Loss Prevention**: Consider how changes affect existing user data.
- **Feature Flags**: Use flags for risky changes to allow gradual rollout.

## Directory Structure

```
src/
├── entrypoints/         # WXT entry points (manifest inputs)
│   ├── background.ts    # Service worker (messaging hub)
│   ├── popup/           # Popup UI
│   └── *.content.ts     # Content scripts
├── components/ui/       # Shadcn-like primitives (Button, Input, Toast...)
├── features/            # Domain modules (aiAssistant/, jenkins/, links/, recorder/...)
│   └── <feature>/      # Structure varies: api/, components/, hooks/, messages.ts, service.ts, utils/
├── db/                  # Dexie schema (schema.ts) + Sync logic
├── lib/                 # Core utilities (ai/, crypto/, db/, http.ts, sync/)
└── utils/               # Helpers (cn.ts, logger.ts, modal.ts, validation.ts)
```

## Code Style

### Imports & Naming

- **Absolute Imports:** Always use `@/` alias (configured in tsconfig.json).
- **Naming Conventions:**
  - Components: `PascalCase.tsx`, `export function ComponentName`
  - Utils: `camelCase.ts`
  - Constants: `UPPER_SNAKE_CASE`

### React Components

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

### Error Handling

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

### Patterns

- **API Clients:** Factory pattern `createClient(credentials)`.
- **Sync:** Use `SyncEngine` class. Sensitive data MUST be encrypted before sync.
- **Styling:** UnoCSS utilities with Shadcn theme colors.
- **Logging:** Use `logger.info/warn/error` from `@/utils/logger`.
- **Classes:** Use `cn()` from `@/utils/cn` for conditional class merging.

## Available Utilities

| Utility        | Location                | Purpose                |
| -------------- | ----------------------- | ---------------------- |
| `logger`       | `@/utils/logger`        | Debug/info/warn/error  |
| `cn`           | `@/utils/cn`            | Merge Tailwind classes |
| `useToast`     | `@/components/ui/toast` | User notifications     |
| `useLiveQuery` | `dexie-react-hooks`     | Reactive DB queries    |

## Data & Synchronization

- **Dexie:** Schema defined in `src/db/schema.ts`, registered in `src/db/index.ts`. Handle versions carefully.
- **SyncEngine:** Handles data replication with E2EE via Web Crypto API.
- **Sensitive data** MUST be encrypted before storing or syncing.

## Pre-commit Hooks

Uses `simple-git-hooks` with `lint-staged`. ESLint auto-fixes and Prettier formats are applied to staged `.ts`/`.tsx` files.

Run `pnpm lint:fix` and `pnpm format` before committing.

## Verification

Before completing any task: `pnpm compile` (MUST PASS), `pnpm lint:fix`, `pnpm build`.
