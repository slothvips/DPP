# Technology Stack

**Analysis Date:** 2026-03-26

## Languages

**Primary:**
- TypeScript 5.9.3 - All source code (`.ts`, `.tsx` files)
- CSS/UnoCSS - Styling via utility-first CSS approach

**Secondary:**
- JSON - Package manifests and configuration files

## Runtime

**Environment:**
- Browser Extension (Chrome/Firefox) via WXT
- React 19.2.3 (DOM rendering)
- Service Worker (background.ts)

**Package Manager:**
- pnpm 10.33.0
- Lockfile: `pnpm-lock.yaml` (present)

## Frameworks

**Core:**
- WXT 0.20.6 - Web Extension framework and build tool
- React 19.2.3 - UI framework with React Compiler (babel-plugin-react-compiler 1.0.0)

**UI/Styling:**
- UnoCSS 66.6.0 - Atomic CSS engine (presetUno, presetIcons, presetTypography)
- Tailwind-compatible class utilities via UnoCSS
- Shadcn UI components (@radix-ui/* packages)
- class-variance-authority 0.7.1 - Component variant handling
- lucide-react 0.563.0 - Icon library

**Database:**
- Dexie 4.2.1 - IndexedDB wrapper
- dexie-react-hooks 4.2.0 - React hooks for Dexie

**State Management:**
- React hooks (useState, useEffect, useLiveQuery)
- Dexie useLiveQuery for reactive database queries

**Build/Dev:**
- Vite 7.x (via WXT) - Build tooling
- Babel with @babel/preset-typescript and babel-plugin-react-compiler
- TypeScript 5.9.3 (strict mode enabled)
- chokidar-cli 3.0.0 - File watching

**Testing:**
- Not explicitly configured (no Jest/Vitest detected in dependencies)

**Code Quality:**
- ESLint 9.17.0 with typescript-eslint 8.18.1
- eslint-plugin-react-hooks 5.1.0
- prettier 3.4.2 with @trivago/prettier-plugin-sort-imports 5.2.0
- lint-staged 16.2.7 with simple-git-hooks 2.13.1 (pre-commit hooks)

## Key Dependencies

**Critical:**
- rrweb 2.0.0-alpha.20 - Session recording/replay
- @rrweb/packer 2.0.0-alpha.20 - rrweb data packing
- page-agent 1.6.1 - In-page automation agent
- monaco-editor 0.55.1 - Code/diff editor
- react-markdown 10.1.0 - Markdown rendering
- remark-gfm 4.0.1 - GitHub-flavored markdown

**Infrastructure:**
- @tanstack/react-virtual 3.13.21 - Virtual list rendering
- allotment 1.20.5 - Resizable split panels
- masonry-layout 4.2.2 - Masonry grid layout

**Utilities:**
- lodash-es 4.17.23 - Utility functions
- date-fns 4.1.0 - Date formatting
- diff 8.0.3 - Text diffing
- clsx 2.1.1, tailwind-merge 3.4.0 - Class name utilities

**AI Integration:**
- Custom providers for Ollama, Anthropic, OpenAI-compatible APIs

## Configuration

**Environment:**
- No `.env` file in repository (secrets not stored in code)
- Settings stored in Dexie IndexedDB via `settings` table
- Configuration keys defined in `src/db/types.ts` (SettingKey type)

**Build:**
- `wxt.config.ts` - WXT extension framework config
- `uno.config.ts` - UnoCSS styling config with custom theme
- `tsconfig.json` - TypeScript config (extends .wxt/tsconfig.json)
- `eslint.config.js` - ESLint rules

**Path Aliases:**
- `@/*` maps to `src/*` (configured in tsconfig.json)

## Platform Requirements

**Development:**
- Node.js (via pnpm)
- Chrome browser (for dev server)
- Firefox (via `pnpm dev:firefox`)

**Production:**
- Chrome 88+ or Firefox 78+ (browser extension)
- IndexedDB support required
- Web Crypto API support required (for E2EE sync)

---

*Stack analysis: 2026-03-26*
