# Coding Conventions

**Analysis Date:** 2026-03-26

## Naming Patterns

**Files:**
- React components: PascalCase (e.g., `AIAssistantView.tsx`, `BuildDialog.tsx`)
- Utilities/hooks: camelCase (e.g., `useLinks.ts`, `logger.ts`, `cn.ts`)
- API modules: camelCase (e.g., `build.ts`, `fetchJobs.ts`)
- Types/interfaces: PascalCase (e.g., `LinkItem`, `JenkinsEnvironment`)
- Database operations: camelCase (e.g., `links.ts`, `tags.ts`)

**Directories:**
- Feature directories: camelCase (e.g., `features/jenkins`, `features/aiAssistant`)
- Library directories: camelCase (e.g., `lib/db`, `lib/sync`, `lib/ai`)
- Component subdirectories: camelCase (e.g., `components/ui`, `components/ui/button.tsx`)

**Functions:**
- General: camelCase (e.g., `listLinks`, `handleJenkinsMessage`, `triggerBuild`)
- React hooks: camelCase with `use` prefix (e.g., `useAIChat`, `useGlobalSync`, `useLinks`)
- Event handlers: camelCase with `handle` prefix (e.g., `handleConfigSaved`, `handlePageAgentInject`)
- Handler functions: camelCase (e.g., `links_list`, `links_add` for AI tools)

**Variables:**
- camelCase for general variables (e.g., `isSyncing`, `localPushCount`)
- Boolean variables often use `is`, `has`, `can` prefixes
- Underscore prefix for ignored parameters: `_` or `_variableName`

**Types:**
- PascalCase for all type names (e.g., `LinkItem`, `JenkinsCredentials`, `SyncEngineOptions`)
- Interface names do not have `I` prefix

## Code Style

**Formatting:**
- Tool: Prettier with `@trivago/prettier-plugin-sort-imports`
- Config: `.prettierrc`
- Print width: 100 characters
- Tab width: 2 spaces
- Semicolons: Required
- Single quotes: Yes
- Trailing commas: ES5 style

**Linting:**
- Tool: ESLint with `typescript-eslint`
- Config: `eslint.config.js`
- React Hooks rules enforced: `react-hooks/rules-of-hooks` (error), `react-hooks/exhaustive-deps` (warn)
- No explicit `any` allowed: `@typescript-eslint/no-explicit-any` (error)
- Unused variables: Warn with underscore ignore pattern

**Editor Config:**
- `.editorconfig` at project root
- UTF-8 charset
- Space indent (2)
- LF line endings
- Trim trailing whitespace
- Final newline in files (except .md)

## Import Organization

**Order (enforced by Prettier plugin):**
1. React imports (`^react`)
2. WXT imports (`^wxt`)
3. External packages (`^@`)
4. Alias imports (`^@/`)
5. Relative imports (`^[./]`)

**Path Aliases:**
- `@/*` maps to `src/*` (configured in `tsconfig.json`)

**Examples:**
```typescript
import { useCallback, useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';
import { logger } from '@/utils/logger';
import { getSetting, updateSetting } from '@/lib/db/settings';
import type { SyncPendingCounts } from '@/lib/sync/types';
import { handleJenkinsMessage } from './background/handlers';
```

## Error Handling

**Patterns:**

1. **Try-catch with specific handling:**
```typescript
// src/features/jenkins/api/build.ts
try {
  const res = await http(apiUrl, { ... });
  if (successStatuses.includes(res.status)) {
    return true;
  }
  logger.error(`Build failed: ${res.status} ${res.statusText}`);
  return false;
} catch (e) {
  logger.error('Build error:', e);
  return false;
}
```

2. **Async operations with .catch():**
```typescript
// src/entrypoints/background.ts
browser.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => logger.error('Failed to set side panel behavior:', error));
```

3. **Error type assertion:**
```typescript
// src/entrypoints/background/handlers/jenkins.ts
const err = e as Error;
logger.error(`Jenkins action ${message.type} failed:`, err);
return { success: false, error: err.message || String(e) };
```

4. **React ErrorBoundary:**
```typescript
// src/components/ErrorBoundary.tsx
export class ErrorBoundary extends React.Component<...> {
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('Uncaught error:', error, errorInfo);
  }
}
```

5. **Result pattern for handlers:**
```typescript
// src/entrypoints/background/handlers/jenkins.ts
export async function handleJenkinsMessage(message: JenkinsMessage): Promise<JenkinsResponse> {
  try {
    // ... operation
    return { success: true, data };
  } catch (e) {
    const err = e as Error;
    return { success: false, error: err.message || String(e) };
  }
}
```

## Logging

**Framework:** Custom logger at `src/utils/logger.ts`

**Levels:**
- `debug`: Development-only messages (filtered in production)
- `info`: General information
- `warn`: Warnings (non-blocking issues)
- `error`: Errors (failures)

**Prefix:** All logs prefixed with `[DPP]`

**Usage:**
```typescript
import { logger } from '@/utils/logger';

logger.info('Background started');
logger.debug('Invalid URL:', url, error);
logger.warn('Failed to fetch crumb, proceeding without it:', e);
logger.error('Build error:', e);
```

## Comments

**JSDoc Style:**
```typescript
// src/lib/http.ts
/**
 * Enhanced fetch with timeout and retry support
 *
 * @param url - The URL to fetch
 * @param options - HTTP options including timeout and retry configuration
 * @returns Promise resolving to Response
 * @throws Error if request fails after all retries
 */
export async function http(url: string, options: HttpOptions = {}): Promise<Response> { ... }
```

**Inline Comments:**
- For complex business logic
- To explain workarounds or non-obvious behavior
- Use sparingly, prefer self-documenting code

**Deprecation Notices:**
```typescript
// src/db/types.ts
export interface LinkItem {
  category: string; // Deprecated, keeping for type safety during migration
}
```

## Function Design

**Size:** Prefer smaller, focused functions. Complex functions are broken into helper functions.

**Parameters:**
- Destructure objects for clarity when >2 parameters
- Use named parameters pattern for complex function signatures:
```typescript
export async function listLinks(args: {
  keyword?: string;
  tags?: string[];
  page?: number;
  pageSize?: number;
}): Promise<{ ... }>
```

**Return Values:**
- Use named exports for utility functions
- Use default exports only for page entry components (e.g., `App.tsx`)
- Always return typed promises

**Async/Await:**
- Prefer async/await over raw Promise chains
- Use `Promise.all()` for parallel operations

## Component Design

**Structure:**
- Functional components with hooks
- Named exports for components
- Co-locate component files within feature directories

**Naming:**
- Components: PascalCase (e.g., `AIAssistantView`, `BuildDialog`)
- Props interfaces: `ComponentNameProps` (e.g., `ButtonProps`)

**Patterns:**
```typescript
// src/components/ui/button.tsx
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
```

## Module Design

**Exports:**
- Barrel files (`index.ts`) for public APIs within modules
- Named exports preferred for better refactoring
- Re-export types explicitly: `export type { LinkItem, JobItem } from './types';`

**State Management:**
- Use `useLiveQuery` from `dexie-react-hooks` for reactive database queries
- Local state with `useState`, derived state with `useMemo`
- Custom hooks for complex state logic (e.g., `useGlobalSync.ts`, `useAIChat.ts`)

## Database Operations

**Pattern (via Dexie):**
```typescript
// src/db/index.ts
export const db = new Dexie('DPPDB') as DPPDatabase;

// Access via db.table() or generated types
const links = await db.links.filter((l) => !l.deletedAt).toArray();
```

**Unified CRUD:**
- All database operations via `src/lib/db/*.ts` modules
- These are used by both AI tools and UI components

## Testing for Automation

**Test IDs:** All interactive elements have `data-testid` attributes

**Examples from CLAUDE.md:**
```html
<button data-testid="settings-button">Settings</button>
<div data-testid="tab-jenkins">Jenkins</div>
<div data-testid="loading">Loading...</div>
```

---

*Convention analysis: 2026-03-26*
