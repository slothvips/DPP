# DPP (Developer Productivity Platform)

## What This Is

A browser extension (Chrome/Firefox) that enhances developer workflow through Jenkins integration, session recording, AI assistance, and productivity tools. Built with WXT + React 19, using IndexedDB for local storage and E2EE sync.

## Core Value

**Make developers more productive** — unify Jenkins workflows, session recording, and AI assistance in one accessible side panel.

## Requirements

### Validated

- ✓ Jenkins build trigger and monitoring — existing
- ✓ Links management with tags — existing
- ✓ Blackboard for notes — existing
- ✓ Session recording with rrweb — existing
- ✓ AI Assistant with multi-provider support — existing
- ✓ Hot News feed — existing
- ✓ Toolbox with developer utilities — existing
- ✓ Light/Dark/System theme toggle — existing
- ✓ E2EE sync between devices — existing

### Active

- [ ] 优化深浅色主题对比度 — 提升主题切换后各组件的可读性和视觉一致性

### Out of Scope

- Adding new features beyond contrast improvement
- Major architectural changes

## Context

**Project Type:** Browser Extension (WXT + React 19)
**UI Framework:** UnoCSS + Shadcn UI components
**State Management:** Dexie.js (IndexedDB) with reactive queries
**Theme System:** Custom `useTheme` hook with CSS variables

**Existing Theme Implementation:**
- `src/hooks/useTheme.ts` — Theme management hook
- `src/components/ThemeToggle.tsx` — Theme switcher component
- CSS variables defined via UnoCSS presetUno
- Supports: light, dark, system

**Known Contrast Issues:**
- Some components may have insufficient contrast in dark mode
- Text colors may not meet WCAG AA standards (4.5:1 for normal text)
- Border colors and background colors may blend in certain combinations
- Icons and interactive elements may have low visibility

## Constraints

- **Tech Stack**: WXT, React 19, TypeScript, UnoCSS — cannot change
- **Theme Compatibility**: Must maintain all three theme modes (light/dark/system)
- **WCAG Standards**: Target AA contrast ratio (4.5:1 normal text, 3:1 large text)
- **No Breaking Changes**: Existing functionality must remain intact

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| UnoCSS + Shadcn UI | Atomic CSS with accessible components | ✓ Works well |
| CSS Variables for theming | Centralized color tokens | ⚠️ Need better contrast values |
| Light/Dark/System themes | User preference support | ✓ Core feature |

---

*Last updated: 2026-03-27 after project initialization*

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state
