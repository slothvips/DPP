# Coding Conventions

**Analysis Date:** 2026-03-27

## Naming Patterns

### Files

- **Components:** PascalCase with descriptive suffixes: `LinksView.tsx`, `BlackboardView.tsx`, `ErrorBoundary.tsx`
- **Hooks:** camelCase with `use` prefix: `useLinks.ts`, `useTheme.ts`, `useAIChat.ts`
- **Utilities:** camelCase: `cn.ts`, `logger.ts`, `validation.ts`, `modal.ts`
- **Types:** PascalCase: `LinkItem`, `TagItem`, `Theme`, `JenkinsEnvironment`
- **Constants:** SCREAMING_SNAKE_CASE: `PREFIX`, `YOLO_MODE_KEY`, `PUSH_BATCH_SIZE`
- **Directories:** kebab-case: `links/`, `blackboard/`, `aiAssistant/`
- **Barrel files:** `index.ts` or `index.tsx` for module exports

### Functions and Variables

- **Functions:** camelCase: `addLink()`, `updateLink()`, `resolveTagNamesToIds()`, `getJenkinsCredentials()`
- **React hooks:** `use` prefix: `useLinks()`, `useTheme()`, `useAIChat()`
- **Message handlers:** `handle` prefix: `handleJenkinsMessage()`, `handleSyncMessage()`
- **Getters:** `get` prefix: `getLink()`, `getClientId()`, `getSettingByKey()`
- **Variables:** camelCase: `existingLink`, `tagIds`, `filteredLinks`, `allLinks`
- **Component instances:** PascalCase: `Button`, `LinkDialog`, `ErrorBoundary`

### Types and Interfaces

- **Interfaces:** PascalCase without "I" prefix: `AIToolMetadata`, not `IAIToolMetadata`
- **Type aliases:** PascalCase for unions: `Theme = 'light' | 'dark' | 'system'`
- **DB Types:** PascalCase: `LinkItem`, `LinkTagItem`, `TagWithCounts`

## Code Style

### Formatting

- **Tool:** Prettier with `@trivago/prettier-plugin-sort-imports`
- **Settings in `.prettierrc`:**
  ```json
  {
    "semi": true,
    "singleQuote": true,
    "tabWidth": 2,
    "trailingComma": "es5",
    "printWidth": 100,
    "bracketSpacing": true
  }
  ```

### Linting

- **Tool:** ESLint with `typescript-eslint` and `eslint-plugin-react-hooks`
- **Config:** `eslint.config.js` at project root
- **Key rules enforced:**
  - `@typescript-eslint/no-unused-vars`: `warn` with `argsIgnorePattern: '^_'`
  - `@typescript-eslint/no-explicit-any`: `error`
  - `react-hooks/rules-of-hooks`: `error`
  - `react-hooks/exhaustive-deps`: `warn`

### Pre-commit Hooks

- **lint-staged** runs on `*.{js,jsx,ts,tsx}` files:
  ```bash
  eslint --fix
  prettier --write
  ```

## Import Organization

**Order (configured in `.prettierrc`):**
1. `^react` - React imports
2. `^wxt` - WXT framework imports
3. `^@` - Path alias imports (`@/`)
4. `^[./]` - Relative imports

**Path alias:** `@/*` maps to `src/*` (configured in `tsconfig.json`)

**Example:**
```typescript
import { useLiveQuery } from 'dexie-react-hooks';
import { browser } from 'wxt/browser';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/utils/cn';
```

## Error Handling

### Pattern for Background Handlers

Background handlers return typed responses and wrap errors:

```typescript
// src/entrypoints/background/handlers/jenkins.ts
export async function handleJenkinsMessage(message: JenkinsMessage): Promise<JenkinsResponse> {
  try {
    // ... logic
    return { success: true, data };
  } catch (e) {
    const err = e as Error;
    logger.error(`Jenkins action ${message.type} failed:`, err);
    return { success: false, error: err.message || String(e) };
  }
}
```

### Pattern for Service/Utility Functions

Functions throw descriptive errors that are caught and displayed via toast:

```typescript
// src/lib/db/links.ts
if (!isValidUrl(args.url)) {
  throw new Error(`URL 格式不正确，请以 http:// 或 https:// 开头`);
}
```

### Pattern for UI Components

Components use try/catch with toast notifications:

```typescript
// src/features/links/components/LinksView.tsx
const handleDelete = async (link: LinkItem) => {
  const confirmed = await confirm(`确定要删除 "${link.name}" 吗？`, '确认删除', 'danger');
  if (confirmed) {
    try {
      await deleteLink(link.id);
      toast('删除成功', 'success');
    } catch (error) {
      logger.error('Failed to delete link:', error);
      toast('删除失败', 'error');
    }
  }
};
```

### React Error Boundary

Class-based ErrorBoundary at `src/components/ErrorBoundary.tsx`:

```typescript
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('Uncaught error:', error, errorInfo);
  }
  // ...
}
```

## Logging

**Framework:** Custom `logger` utility at `src/utils/logger.ts`

**Prefix:** `[DPP]`

**Pattern:**
```typescript
const PREFIX = '[DPP]';

const logger = {
  debug: (...args) => log('debug', ...args),
  info: (...args) => log('info', ...args),
  warn: (...args) => log('warn', ...args),
  error: (...args) => log('error', ...args),
};

// Usage
logger.debug('Invalid URL:', url, error);
logger.info('Connection established');
logger.warn('Failed to fetch crumb, proceeding without it:', e);
logger.error('Build error:', e);
```

**Dev-only debug:** `if (level === 'debug' && !isDev) return;`

## Comments

- **JSDoc** for public functions: `/** Validate URL format */`
- **Type documentation:** `@param`, `@returns`
- **Chinese comments** for user-facing strings (errors, labels, tooltips)
- **Inline comments** for complex business logic explanations

**Example:**
```typescript
/**
 * Convert tag names to tag IDs
 * Handles both tag names (from AI) and tag IDs (from UI)
 */
async function resolveTagNamesToIds(tagsInput: string[]): Promise<string[]> {
  // ...
}
```

## Function Design

### Multiple Arguments

Use object destructuring with defaults:

```typescript
// Good
export async function listLinks(args: {
  keyword?: string;
  tags?: string[];
  page?: number;
  pageSize?: number;
}): Promise<{ ... }> {
  const page = args.page ?? 1;
  const pageSize = args.pageSize ?? 20;
  // ...
}
```

### Return Values

- **Nullable returns:** `Promise<LinkItem | null>`
- **Operation results:** `{ success: boolean; message: string }` or `{ success: boolean; id: string; message: string }`
- **List with pagination:** `{ total: number; page: number; pageSize: number; hasMore: boolean; links: [...] }`

## Module Design

### Named Exports Preferred

```typescript
// src/entrypoints/background/handlers/index.ts
export { handleJenkinsMessage, getJenkinsCredentials } from './jenkins';
export type { JenkinsMessage, JenkinsResponse } from './jenkins';
```

### Class-based Services

For complex services like SyncEngine:

```typescript
// src/lib/sync/SyncEngine.ts
export class SyncEngine {
  private db: Dexie;
  private tables: string[];
  private provider: SyncProvider;

  private syncLock = false;
  private eventListeners: Map<SyncEventType, Set<SyncEventCallback>> = new Map();

  async getClientId(): Promise<string> {
    return await this.ensureClientId();
  }
  // ...
}
```

### Singleton Registry Pattern

```typescript
// src/lib/ai/tools.ts
class ToolRegistry {
  private tools: Map<string, AIToolMetadata> = new Map();

  register(tool: AIToolMetadata): void { /* ... */ }
  get(name: string): AIToolMetadata | undefined { /* ... */ }
  async execute<T = unknown>(name: string, args: Record<string, unknown>): Promise<T> { /* ... */ }
}

export const toolRegistry = new ToolRegistry();
```

## Component Patterns

### Functional Components with Hooks

```typescript
// src/features/links/components/LinksView.tsx
export function LinksView() {
  const { links, recordVisit, togglePin, addLink, updateLink, deleteLink } = useLinks();
  const allTags = useLiveQuery(() => db.tags.filter((t) => !t.deletedAt).toArray()) || [];
  const [search, setSearch] = useState('');
  // ...
}
```

### ForwardRef for UI Components

```typescript
// src/components/ui/button.tsx
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = 'Button';
```

### Context Pattern for Global State

```typescript
// src/utils/confirm-dialog.tsx
const ConfirmDialogContext = createContext<ConfirmDialogContextValue | null>(null);

export function useConfirmDialog() {
  const context = useContext(ConfirmDialogContext);
  if (!context) {
    throw new Error('useConfirmDialog must be used within ConfirmDialogProvider');
  }
  return context;
}
```

---

*Convention analysis: 2026-03-27*
