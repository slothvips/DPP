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

- **No `any`**: Use `unknown` or specific types. ESLint is configured to error on `any`.
- **No Suppressions**: Do not use `@ts-ignore` or `@ts-expect-error`. Fix the underlying issue.
- **Unused Vars**: Prefix unused variables with `_` (e.g., `_req`) to satisfy linter.
- **No Relative Parent Imports**: Always use `@/` alias (e.g., `@/components/...`) instead of `../../`.
- **Strict Equality**: Always use `===` and `!==`.
- **Functional Components**: Use `function Name() {}` syntax, not `const Name = () => {}`.
- **Async Safety**: Always `await` promises or explicitly void them. No floating promises.
- **Error Handling**: Use `try-catch` with `logger.error` and `toast` for user feedback.

## 3. Commands

Execute from project root. NEVER `cd` into subdirectories.

```bash
# Development
pnpm dev              # Chrome dev server
pnpm dev:firefox      # Firefox dev server
pnpm build            # Production build → .output/
pnpm build:firefox    # Firefox production build

# Quality Control (Run Before Committing)
pnpm compile          # Type check (tsc --noEmit) - MUST PASS
pnpm lint             # ESLint check
pnpm lint:fix         # Auto-fix lint issues
pnpm format           # Prettier format
```

**Note:** This project currently has no test suite. Do not create test files without explicit user request.

## 4. Directory Structure

```
src/
├── entrypoints/         # WXT entry points (manifest inputs)
│   ├── background.ts    # Service worker (messaging hub)
│   ├── popup/           # Popup UI
│   └── *.content.ts     # Content scripts
├── components/
│   └── ui/              # Shadcn-like primitives (Button, Input, Toast...)
├── features/            # Domain modules (jenkins/, links/, recorder/)
│   └── <feature>/
│       ├── api/         # API clients (createClient pattern)
│       ├── components/  # Feature-specific UI
│       ├── hooks/       # Feature-specific hooks
│       ├── messages.ts  # Feature-specific messaging
│       └── types.ts     # Type definitions
├── db/                  # Dexie schema (index.ts) + Sync logic
├── lib/                 # Core utilities (crypto/, sync/)
└── utils/               # Helpers (cn.ts, logger.ts)
```

## 5. Code Style

### 5.1 Imports & Naming

- **Absolute Imports:** ALWAYS use `@/` alias. Configure in `tsconfig.json` paths.
- **Order:** `react` → `wxt` → `@/...` → `./...` (Prettier will sort this).
- **Naming:**
  - Components: `PascalCase.tsx`, `export function ComponentName`.
  - Utils: `camelCase.ts`.
  - Constants: `UPPER_SNAKE_CASE`.

### 5.2 React Components

- **Pattern:** Use `function Component() {}`.
- **Props:** Define interface. Pass `className` to root via `cn()`.
- **Data:** Use `useLiveQuery` from `dexie-react-hooks`.
- **UI:** Reuse `src/components/ui`. Use `useToast()` for notifications.

```tsx
import { useToast } from '@/components/ui/toast';
import { cn } from '@/utils/cn';

export function Badge({ variant = 'default', className, ...props }: BadgeProps) {
  return (
    <div
      className={cn('rounded px-2', variant === 'success' && 'bg-success', className)}
      {...props}
    />
  );
}
```

### 5.3 Error Handling

Always wrap async operations in try-catch. Use `logger` for logging and `toast` for user feedback.

```tsx
async function fetchData() {
  try {
    const result = await api.getData();
    return result;
  } catch (err) {
    logger.error('Failed to fetch data', err);
    toast({ title: 'Error', description: 'Failed to fetch data' });
    throw err;
  }
}
```

### 5.4 Patterns

- **API Clients:** Factory pattern `createClient(credentials)`.
- **Sync:** Use `SyncEngine` class. Sensitive data MUST be encrypted before sync.
- **Styling:** `UnoCSS` utility classes with Shadcn theme colors.
- **Logging:** Use `logger.info/warn/error` from `@/utils/logger`.
- **Classes:** Use `cn()` from `@/utils/cn` for conditional class merging.

## 6. Available Utilities

| Utility        | Location                | Purpose                       |
| -------------- | ----------------------- | ----------------------------- |
| `logger`       | `@/utils/logger`        | Debug/info/warn/error logging |
| `cn`           | `@/utils/cn`            | Merge Tailwind classes        |
| `useToast`     | `@/components/ui/toast` | User notifications            |
| `useLiveQuery` | `dexie-react-hooks`     | Reactive DB queries           |

## 7. Data & Synchronization

- **Dexie:** Define schema in `src/db/index.ts`. Handle versions carefully.
- **SyncEngine:** Handles data replication with E2EE via Web Crypto API.
- **Sensitive data** MUST be encrypted before being stored or synced.

## 8. Pre-commit Hooks

This project uses `simple-git-hooks` with `lint-staged`. Before committing:

- ESLint auto-fixes will be applied
- Prettier will format changed files

Run `pnpm lint:fix` and `pnpm format` before committing to avoid hook failures.

## 9. Agent Workflow

1.  **Analyze:**
    - Read related files (Schema, API, UI components).
    - Check `src/components/ui` for reusable primitives.
2.  **Plan:**
    - Create a TODO list for complex tasks.
    - Map out new files and schema changes.
3.  **Implement:**
    - Use `pnpm`. Use `cn()`. Follow types strictly.
    - Handle errors with try-catch + logger + toast.
4.  **Verify:**
    - `pnpm compile` (MUST PASS).
    - `pnpm lint:fix`.
    - `pnpm build` to ensure production build works.
