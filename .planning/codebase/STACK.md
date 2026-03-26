# Technology Stack

**Analysis Date:** 2026-03-27

## Languages

**Primary:**
- TypeScript 5.9.3 - All extension code, server code, and packages

**Secondary:**
- CSS/UnoCSS - Styling via utility-first approach

## Runtime

**Environment:**
- Chrome/Firefox browser extensions (WXT framework)
- Node.js 20+ (for node-server package)

**Package Manager:**
- pnpm 10.33.0
- Lockfile: `pnpm-lock.yaml` (present)

## Frameworks

**Core:**
- WXT 0.20.6 - Web Extension Tools framework (Chrome/Firefox)
- React 19.2.3 - UI framework
- React DOM 19.2.3 - DOM rendering

**Build/Dev:**
- Vite (via WXT) - Build tool
- UnoCSS 66.6.0 - Atomic CSS engine
- Babel 7.28.5 (via vite-plugin-babel) - TypeScript transpilation with React Compiler
- Babel Plugin React Compiler 1.0.0 - React 19 optimization

**Testing:**
- No formal test framework detected (manual testing via Chrome DevTools MCP)

**Database:**
- Dexie 4.2.1 - IndexedDB wrapper
- dexie-react-hooks 4.2.0 - React hooks for Dexie

**UI Components:**
- Radix UI (multiple packages) - Headless UI primitives
  - @radix-ui/react-checkbox 1.3.3
  - @radix-ui/react-dialog 1.1.15
  - @radix-ui/react-popover 1.1.15
  - @radix-ui/react-select 2.2.6
  - @radix-ui/react-slot 1.2.4
- class-variance-authority 0.7.1 - Component variant styling
- clsx 2.1.1 - Conditional classNames
- tailwind-merge 3.4.0 - Tailwind class merging

**Code Editor:**
- Monaco Editor 0.55.1 - VS Code's editor component
- @codingame/monaco-vscode-multi-diff-editor-service-override 28.3.1

**Session Recording:**
- rrweb 2.0.0-alpha.20 - Session recording and replay
- @rrweb/packer 2.0.0-alpha.20
- @rrweb/types 2.0.0-alpha.20

**AI/ML:**
- page-agent 1.6.1 - In-page automation agent

## Key Dependencies

**Critical:**
- react 19.2.3 - UI rendering
- dexie 4.2.1 - Local database (IndexedDB)
- wxt 0.20.6 - Extension framework

**Utilities:**
- lodash-es 4.17.23 - Utility functions
- date-fns 4.1.0 - Date manipulation
- diff 8.0.3 - Diff algorithm
- lucide-react 0.563.0 - Icons
- react-markdown 10.1.0 - Markdown rendering
- remark-gfm 4.0.1 - GitHub Flavored Markdown

**Layout:**
- allotment 1.20.5 - Split panes
- masonry-layout 4.2.2 - Masonry layout
- @tanstack/react-virtual 3.13.21 - Virtual scrolling

**Data Visualization:**
- react-diff-viewer-continued 4.2.0 - Diff viewer component

## Configuration

**TypeScript:**
- `tsconfig.json` extends `.wxt/tsconfig.json`
- Path alias: `@/*` maps to `src/*`
- Strict mode enabled

**ESLint:**
- `eslint.config.js` uses typescript-eslint
- React Hooks rules enforced
- No explicit-any is error
- Prettier integration via eslint-config-prettier

**UnoCSS:**
- `uno.config.ts` - UnoCSS configuration
- Presets: preset-uno, preset-icons

**WXT:**
- `wxt.config.ts` - Extension configuration
- Manifest V3 permissions: storage, sidePanel, alarms, activeTab, scripting, tabs
- Host permissions: `<all_urls>`

**Build:**
- Chunk size warning limit: 7000KB (increased from default)
- Development mode adds "(DEV)" suffix to extension name

## Platform Requirements

**Development:**
- Node.js 20+
- pnpm 10+
- Chrome or Firefox browser for testing

**Production:**
- Chrome 88+ or Firefox 78+
- Manifest V3 support

---

*Stack analysis: 2026-03-27*
