# Phase 1: Audit and Measurement - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Identify all contrast-affecting patterns and establish baseline metrics through grep audits and documentation. This is the foundation for Phase 2 (Token Corrections) and Phase 3 (Component Hardening).

**Scope:**
- Grep audit of `muted-foreground/[0-9]+` opacity patterns
- Grep audit of `dark:bg-[a-z]+/[0-9]+` dark mode modifier patterns
- Grep audit of hardcoded colors (`bg-[a-z]+-[0-9]+`) in feature components
- Document baseline contrast ratios for CSS variable pairs
- Document text hierarchy standards (opacity values)

**Out of scope:**
- Implementing fixes (Phase 2+)
- Visual design decisions
</domain>

<decisions>
## Implementation Decisions

### Audit Format
- **D-01:** Grep output + Markdown documentation
- Grep commands capture pattern locations
- Markdown tables organize findings by category
- File paths with line numbers for each finding

### Baseline Documentation
- **D-02:** Manual grep + contrast ratio estimation
- Use HSL math to estimate contrast ratios
- Document current values vs WCAG AA thresholds
- Focus on dark mode (where most issues exist)

### Claude's Discretion
- Exact grep command syntax
- Documentation structure and formatting
- Which patterns to prioritize in findings
</decisions>

<canonical_refs>
## Canonical References

### Theme Architecture
- `.planning/research/ARCHITECTURE.md` — Token layers, integration points, contrast analysis
- `.planning/research/PITFALLS.md` — Known opacity stacking issues, hardcoded color patterns
- `.planning/research/FEATURES.md` — Component priorities for audit

### Requirements
- `.planning/REQUIREMENTS.md` — A11Y-01 through A11Y-04 (audit requirements)

### Codebase
- `uno.config.ts` — Theme token definitions (audit target)
- `src/components/ui/` — Shadcn UI components (audit target)
- `src/features/*/components/*.tsx` — Feature components (audit target)
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `cn()` utility: `src/utils/cn.ts` — Class merging utility
- `useTheme` hook: `src/hooks/useTheme.ts` — Theme state management

### Established Patterns
- CSS variables in `uno.config.ts` preflights for theming
- Utility classes (bg-*, text-*, border-*) for styling
- Opacity modifiers (e.g., `text-muted-foreground/60`)

### Integration Points
- Grep targets: `src/components/ui/`, `src/features/*/components/`
- Theme tokens: `uno.config.ts` lines 153-196
</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.
</deferred>

---
*Phase: 01-audit-and-measurement*
*Context gathered: 2026-03-27*
