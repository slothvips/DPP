# Roadmap: DPP Theme Contrast Improvement

**Milestone:** v1.0
**Granularity:** coarse
**Created:** 2026-03-27

## Core Value

Make developers more productive — unify Jenkins workflows, session recording, and AI assistance in one accessible side panel with proper theme contrast.

## Phases

- [ ] **Phase 1: Audit and Measurement** - Identify all contrast-affecting patterns and establish baseline metrics
- [ ] **Phase 2: Token Value Corrections** - Fix CSS variable values in uno.config.ts for WCAG AA compliance
- [ ] **Phase 3: Component Hardening** - Replace hardcoded colors with theme tokens across features
- [ ] **Phase 4: Verification and Polish** - Confirm WCAG AA compliance across all components and states

---

## Phase Details

### Phase 1: Audit and Measurement

**Goal:** Identify all contrast-affecting patterns and establish baseline metrics

**Depends on:** Nothing (first phase)

**Requirements:** A11Y-01, A11Y-02, A11Y-03, A11Y-04

**Success Criteria** (what must be TRUE):
1. All `muted-foreground/[0-9]+` opacity patterns are documented with locations
2. All `dark:bg-[a-z]+/[0-9]+` dark mode modifier patterns are documented with locations
3. All hardcoded `bg-[a-z]+-[0-9]+` colors in feature components are documented with locations
4. Baseline contrast ratios for all CSS variable pairs are documented for both light and dark themes
5. Text hierarchy standards are documented (approved opacity values for each level)

**Plans:** 1/3 plans executed

Plans:
- [ ] 01-01-PLAN.md - Setup (color2k install) + A11Y-01 audit
- [x] 01-02-PLAN.md - A11Y-02 and A11Y-03 audits
- [ ] 01-03-PLAN.md - A11Y-04 contrast ratios + phase summary

---

### Phase 2: Token Value Corrections

**Goal:** Fix CSS variable values in uno.config.ts for WCAG AA compliance

**Depends on:** Phase 1

**Requirements:** A11Y-05, A11Y-06, A11Y-07, A11Y-08, A11Y-09

**Success Criteria** (what must be TRUE):
1. User sees `--muted-foreground` text at 4.5:1+ contrast ratio on `--muted` background in dark mode
2. User sees visible border separation between elements in dark mode (border on background)
3. User sees visible focus rings when navigating with keyboard in both light and dark themes
4. User sees `--card` background visually distinguishable from `--page/background` in dark mode
5. User sees consistent, approved text hierarchy with documented opacity values across all components

**Plans:** TBD

---

### Phase 3: Component Hardening

**Goal:** Replace hardcoded colors with theme tokens across feature components

**Depends on:** Phase 2

**Requirements:** A11Y-10, A11Y-11, A11Y-12, A11Y-13, A11Y-14

**Success Criteria** (what must be TRUE):
1. User sees consistent Jenkins feature colors that match theme in both light and dark modes
2. User sees consistent recorder feature colors that match theme in both light and dark modes
3. User reads sticky note text in dark mode without straining (4.5:1+ contrast)
4. User reads input placeholder text in dark mode without straining (3:1+ contrast for large text)
5. User distinguishes status colors (success/warning/error) clearly in both themes

**Plans:** TBD

---

### Phase 4: Verification and Polish

**Goal:** Confirm WCAG AA compliance across all components and interaction states

**Depends on:** Phase 3

**Requirements:** A11Y-15, A11Y-16, A11Y-17

**Success Criteria** (what must be TRUE):
1. Automated accessibility check reports zero WCAG AA failures
2. User experiences consistent shadcn component styling (hover, active, disabled) in both themes
3. User sees visible focus indicator on every interactive element during keyboard navigation

**Plans:** TBD

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Audit and Measurement | 1/3 | In Progress|  |
| 2. Token Value Corrections | 0/1 | Not started | - |
| 3. Component Hardening | 0/1 | Not started | - |
| 4. Verification and Polish | 0/1 | Not started | - |

## Coverage

- v1 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0

## Dependencies

```
Phase 1 (Audit)
    ↓
Phase 2 (Token Corrections)
    ↓
Phase 3 (Component Hardening)
    ↓
Phase 4 (Verification)
```

---

*Last updated: 2026-03-27*
