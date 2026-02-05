# DPP (WXT + React) Agent Guidelines

这个项目目前还在开发探索阶段,你可以让我配合你做出一些破坏性更新,只要能让项目的代码设计更好,用户体验更优秀,我愿意配合你做出任何调整.

AI agents working on this codebase MUST follow these guidelines strictly.

## 1. Project Overview

| Stack       | Technology                               |
| ----------- | ---------------------------------------- |
| Framework   | WXT (Web Extension Tools) + React 19     |
| Language    | TypeScript (Strict)                      |
| Styling     | UnoCSS + Shadcn theme variables          |
| Icons       | Lucide React, Unocss Icons               |
| State/DB    | Dexie.js (IndexedDB) + dexie-react-hooks |
| Sync        | Custom SyncEngine + E2E Encryption       |
| Pkg Manager | **pnpm** (NEVER use npm/yarn)            |

## 2. Critical Rules

- **No `any`**: Use `unknown` or specific types. Avoid `any` at all costs.
- **No Suppressions**: Do not use `@ts-ignore` or `@ts-expect-error`. Fix the underlying issue.
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

# Quality Control (Run Before Committing)
pnpm compile          # Type check (tsc --noEmit) - MUST PASS
pnpm lint             # ESLint check (eslint.config.js)
pnpm lint:fix         # Auto-fix lint issues
pnpm format           # Prettier format

# Testing (Vitest)
pnpm test             # Run all tests in watch mode
pnpm test -- run      # Run all tests once (CI mode)
pnpm test -- path/to/file.test.ts   # Run single test file (IMPORTANT)
pnpm test:coverage    # Run tests with coverage report
```

## 4. Directory Structure

```
src/
├── entrypoints/         # WXT entry points (manifest inputs)
│   ├── background.ts    # Service worker (messaging hub)
│   ├── popup/           # Popup UI
│   ├── options/         # Options page
│   └── *.content.ts     # Content scripts
├── components/
│   └── ui/              # Shadcn-like primitives (Button, Input, Toast...)
├── features/            # Domain modules (jenkins/, links/, hotNews/)
│   └── <feature>/
│       ├── api/         # API clients (createClient pattern)
│       ├── components/  # Feature-specific UI
│       ├── hooks/       # Feature-specific hooks (useLinks, etc.)
│       ├── utils/       # Feature-specific helpers
│       └── types.ts     # Type definitions
├── db/                  # Dexie schema (index.ts) + Sync logic
├── lib/                 # Core utilities
│   ├── crypto/          # Encryption (E2EE)
│   └── sync/            # SyncEngine implementation
└── utils/               # Helpers (cn.ts, logger.ts)
```

## 5. Code Style

### 5.1 Imports & Naming

- **Absolute Imports:** ALWAYS use `@/` alias.
- **Order:** `react` → `wxt` → `@/...` → `./...` (Prettier will sort this).
- **Naming:**
  - Files: `PascalCase.tsx` for components, `camelCase.ts` for utils.
  - Components: `export function ComponentName`.
  - Interfaces: `PascalCase`, plain names (no `I` prefix).
  - Constants: `UPPER_SNAKE_CASE` for global constants.

### 5.2 React Components

- **Syntax:** Use `function Component() {}` declaration.
- **Props:** Define interface for props. Pass `className` to root via `cn()`.
- **Hooks:**
  - Use `useLiveQuery` from `dexie-react-hooks` for DB data.
  - Custom hooks should return data + operations (e.g., `{ links, addLink }`).
- **UI:** Reuse `src/components/ui` primitives.
- **Toasts:** Use `useToast()` from `@/components/ui/toast` for notifications.

```tsx
import { useToast } from '@/components/ui/toast';
import { cn } from '@/utils/cn';

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'success';
}

export function Badge({ variant = 'default', className, ...props }: BadgeProps) {
  return (
    <div
      className={cn('rounded px-2 py-1', variant === 'success' && 'bg-success', className)}
      {...props}
    />
  );
}
```

### 5.3 Testing (Vitest)

- **Mocking:** Use `vi.fn()` and `vi.mock`.
- **Browser APIs:** Mock `browser.runtime` carefully as seen in `jenkins/service.test.ts`.
- **Assertions:** Use `expect(...).toHaveBeenCalledWith(...)` for messaging.

```typescript
// Example: Mocking browser.runtime.sendMessage
const mockSendMessage = vi.fn();
if (typeof browser !== 'undefined') {
  browser.runtime.sendMessage = mockSendMessage;
} else {
  // @ts-expect-error - defining global for test env
  global.browser = { runtime: { sendMessage: mockSendMessage } };
}
```

### 5.4 Patterns

- **API Clients:** Use factory pattern `createClient(credentials)` (e.g., `createJenkinsClient`).
- **Sync:** Use `SyncEngine` class for data replication.
- **Styling:** Use `UnoCSS` utility classes. Use `cva` for component variants.
- **Logging:** Use `logger.info/warn/error` from `@/utils/logger` instead of `console.log`.

## 6. Data & Synchronization

- **Dexie:** Define schema in `src/db/index.ts`. Handle versions carefully (preserve data).
- **Access:** Use `db.table.add/put/get` in logic, `useLiveQuery` in components.
- **Sync:** The `SyncEngine` handles data replication. Ensure sensitive data is encrypted via `crypto` lib before sync if modifying `SyncProvider`.

## 7. Agent Workflow

1.  **Analyze:**
    - Read related files first.
    - Check `src/components/ui` for existing primitives.
    - Understand the feature structure in `src/features`.
2.  **Plan:**
    - Create a TODO list for complex tasks.
    - Map out new files if creating a feature.
    - If modifying DB, plan for schema migration.
3.  **Implement:**
    - Use `pnpm` for all commands.
    - Use `cn()` for all class merging.
    - Strictly follow TypeScript types.
    - Handle errors gracefully (try-catch + toast + logger).
4.  **Verify:**
    - Run `pnpm compile` (Critical).
    - Run `pnpm lint:fix`.
    - Run `pnpm format`.
    - Ensure build passes before finishing.
