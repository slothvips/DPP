# Technology Stack

**Analysis Date:** 2026-03-27

## Languages

**Primary:**
- TypeScript 5.9.3 - All extension code, server code, and packages

**Secondary:**
- CSS - Styling via UnoCSS utility-first approach

## Runtime

**Environment:**
- Chrome/Firefox browser extensions (WXT framework)
- Node.js 20+ (for node-server package)
- pnpm 10.33.0
- Lockfile: `pnpm-lock.yaml` (present)

## Frameworks

**Core:**
- WXT 0.20.6 - Web Extension Tools framework (Chrome/Firefox)
- React 19.2.3 - UI framework
- React DOM 19.2.3 - DOM rendering
- Hono 4.x - Lightweight web framework for server packages

**Build/Dev:**
- Vite (via WXT) - Build tool
- UnoCSS 66.6.0 - Atomic CSS engine
- Babel 7.28.5 (via vite-plugin-babel) - TypeScript transpilation with React Compiler
- Babel Plugin React Compiler 1.0.0 - React 19 optimization
- Wrangler 4.x - Cloudflare Workers deployment (cf-worker-googlesheet)

**UI Components:**
- Radix UI (multiple packages) - Headless UI primitives
- class-variance-authority 0.7.1 - Component variant styling
- clsx 2.1.1 - Conditional classNames
- tailwind-merge 3.4.0 - Tailwind class merging
- lucide-react 0.563.0 - Icons
- Monaco Editor 0.55.1 - VS Code's editor component

**Data & Storage:**
- Dexie 4.2.1 - IndexedDB wrapper
- dexie-react-hooks 4.2.0 - React hooks for Dexie
- better-sqlite3 9.0.0 - SQLite (node-server package)

**Recording & Replay:**
- rrweb 2.0.0-alpha.20 - Session recording and replay
- @rrweb/packer 2.0.0-alpha.20 - rrweb packing
- @rrweb/types 2.0.0-alpha.20 - rrweb type definitions

**AI Integration:**
- page-agent 1.6.1 - In-page automation agent

## Key Dependencies

**Critical:**
- react 19.2.3 - UI rendering
- dexie 4.2.1 - Local database (IndexedDB)
- wxt 0.20.6 - Extension framework
- lodash-es 4.17.23 - Utility functions
- date-fns 4.1.0 - Date manipulation
- diff 8.0.3 - Diff algorithm

**Layout & Display:**
- allotment 1.20.5 - Split panes
- masonry-layout 4.2.2 - Masonry layout
- @tanstack/react-virtual 3.13.21 - Virtual scrolling
- react-diff-viewer-continued 4.2.0 - Diff viewer component

**Markdown:**
- react-markdown 10.1.0 - Markdown rendering
- remark-gfm 4.0.1 - GitHub Flavored Markdown

**AI/ML:**
- @codingame/monaco-vscode-multi-diff-editor-service-override 28.3.1 - Monaco editor service override
- google-auth-library 10.5.0 - Google authentication (cf-worker-googlesheet)
- google-spreadsheet 5.0.2 - Google Sheets API (cf-worker-googlesheet)
- jose 6.1.3 - JWT handling (cf-worker-googlesheet)

## Configuration

**Environment:**
- `wxt.config.ts` - WXT extension configuration
- `uno.config.ts` - UnoCSS theming with CSS custom properties
- `tsconfig.json` extends `.wxt/tsconfig.json` with path alias `@/*` -> `src/*`
- Strict mode enabled
- Path aliases: `@/*` maps to `src/*`

**Build:**
- Chunk size warning limit: 7000KB (increased from default)
- Dev mode adds "(DEV)" suffix to extension name
- Web accessible resources include interceptors and PageAgent

**Linting/Formatting:**
- ESLint with `typescript-eslint` and `eslint-plugin-react-hooks`
- Prettier with `@trivago/prettier-plugin-sort-imports`
- Import order: `^react`, `^wxt`, `^@`, `^[./]` (react first, then wxt, then @ aliases, then relative)
- No explicit-any is error
- React Hooks rules enforced

**Git Hooks:**
- Pre-commit: `lint-staged` runs `eslint --fix` and `prettier --write`

## Platform Requirements

**Development:**
- Node.js 20+
- pnpm 10+
- Chrome or Firefox browser for testing
- Chrome 88+ or Firefox 78+

**Production:**
- Manifest V3 support
- Browser extension permissions: storage, sidePanel, alarms, activeTab, scripting, tabs
- Host permissions: `<all_urls>`

---

*Stack analysis: 2026-03-27*
