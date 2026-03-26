# Coding Conventions

**Analysis Date:** 2026-03-27

## Naming Patterns

**Files:**
- PascalCase for components: `LinksView.tsx`, `BlackboardView.tsx`, `ErrorBoundary.tsx`
- camelCase for utilities/hooks: `useLinks.ts`, `useTheme.ts`, `cn.ts`, `logger.ts`
- kebab-case for directories: `links/`, `blackboard/`, `aiAssistant/`
- Index files for barrel exports: `index.ts`, `index.tsx`

**Functions:**
- camelCase: `addLink()`, `updateLink()`, `resolveTagNamesToIds()`
- use-prefix for React hooks: `useLinks()`, `useTheme()`, `useAIChat()`
- handle-prefix for message handlers: `handleJenkinsMessage()`, `handleSyncMessage()`
- get-prefix for getters: `getLink()`, `getClientId()`, `getSettingByKey()`

**Variables:**
- camelCase: `existingLink`, `tagIds`, `filteredLinks`
- PascalCase for React components and types: `LinkItem`, `TagItem`, `Theme`
- SCREAMING_SNAKE_CASE for constants: `PREFIX`, `YOLO_MODE_KEY`, `PUSH_BATCH_SIZE`

**Types:**
- PascalCase with descriptive suffixes: `LinkItem`, `LinkTagItem`, `SyncOperation`
- Interface names without "I" prefix: `AIToolMetadata`, not `IAIToolMetadata`
- Type aliases for unions: `Theme = 'light' | 'dark' | 'system'`

## Code Style

**Formatting:**
- Tool: Prettier with `@trivago/prettier-plugin-sort-imports`
- Settings: `package.json` at project root
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
- Import order: `^react`, `^wxt`, `^@`, `^[./]` (react first, then wxt, then @ aliases, then relative)

**Linting:**
- Tool: ESLint with `typescript-eslint` and `eslint-plugin-react-hooks`
- Config: `eslint.config.js` at project root
- Key rules enforced:
  - `@typescript-eslint/no-explicit-any`: error (no implicit `any`)
  - `@typescript-eslint/no-unused-vars`: warn (with `_` prefix allowance)
  - `react-hooks/rules-of-hooks`: error
  - `react-hooks/exhaustive-deps`: warn

**Git Hooks:**
- Pre-commit: `lint-staged` runs `eslint --fix` and `prettier --write`
- Simple-git-hooks configured in `package.json`

## Import Organization

**Path Aliases:**
- `@/*` maps to `src/*` (configured in `tsconfig.json`)
- Example: `import { db } from '@/db'`, `import { logger } from '@/utils/logger'`

**Import Order (via Prettier plugin):**
1. React: `^react`
2. Wxt: `^wxt`
3. @ aliases: `^@`
4. Relative imports: `^[./]`

**Barrel Files:**
- Feature modules use `index.ts` for exports: `src/features/links/hooks/index.ts`
- Handler modules export from `index.ts`: `src/entrypoints/background/handlers/index.ts`

## Error Handling

**Patterns:**

1. **Try-catch with error logging:**
   ```typescript
   try {
     await someOperation();
   } catch (e) {
     logger.error('Failed to delete link:', error);
     toast('删除失败', 'error');
   }
   ```

2. **Error throwing for validation failures:**
   ```typescript
   if (!isValidUrl(args.url)) {
     throw new Error(`URL 格式不正确，请以 http:// 或 https:// 开头`);
   }
   ```

3. **Error type narrowing:**
   ```typescript
   const message = error instanceof Error ? error.message : '保存失败';
   ```

4. **Silent catch for non-critical operations:**
   ```typescript
   browser.runtime.sendMessage({ type: 'AUTO_SYNC_TRIGGER_PUSH' }).catch(() => {});
   ```

5. **Class-based error boundary (React):**
   ```typescript
   export class ErrorBoundary extends React.Component {
     static getDerivedStateFromError(error: Error) {
       return { hasError: true, error };
     }
     componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
       logger.error('Uncaught error:', error, errorInfo);
     }
   }
   ```

## Logging

**Framework:** Custom logger at `src/utils/logger.ts`

**Usage:**
```typescript
import { logger } from '@/utils/logger';

logger.debug('Debug info:', data);  // Only in DEV mode
logger.info('Operation completed');
logger.warn('Potential issue:', details);
logger.error('Operation failed:', error);
```

**Implementation:**
- Prefix: `[DPP]`
- Dev-only debug: `if (level === 'debug' && !isDev) return;`
- Console method mapping: debug -> log, info/warn/error -> respective methods

## Comments

**When to Comment:**
- JSDoc for public functions: `/** Validate URL format */`
- Type documentation: `@param`, `@returns`
- Complex business logic explanations
- Chinese comments for user-facing strings

**Examples:**
```typescript
/**
 * Convert tag names to tag IDs
 * Handles both tag names (from AI) and tag IDs (from UI)
 */
async function resolveTagNamesToIds(tagsInput: string[]): Promise<string[]>

/**
 * Unified synchronization lock to prevent concurrent push/pull operations
 * This replaces the separate isSyncing and isPushing flags to prevent race conditions
 */
private syncLock = false;
```

## Function Design

**Size:** Keep functions focused (one responsibility)

**Parameters:**
- Use objects for functions with multiple args:
  ```typescript
  export async function listLinks(args: {
    keyword?: string;
    tags?: string[];
    page?: number;
    pageSize?: number;
  })
  ```
- Destructure with defaults: `const page = args.page ?? 1;`

**Return Values:**
- Consistent return objects: `{ success: boolean; message: string }`
- Nullable returns: `Promise<LinkItem | null>`
- Async/await preferred over raw promises

## Module Design

**Exports:**
- Named exports preferred
- Barrel files for feature modules
- Type exports alongside implementation

**Pattern:**
```typescript
// src/features/links/hooks/useLinks.ts
export function useLinks() {
  // hook implementation
}

// src/features/links/hooks/index.ts
export { useLinks } from './useLinks';
```

**Class usage:** Rare; most logic uses functional patterns with hooks

---

*Convention analysis: 2026-03-27*
