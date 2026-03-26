# Phase 2: Token Value Corrections - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix CSS variable values in `uno.config.ts` for WCAG AA compliance. This is a token-level-only phase — changes to uno.config.ts values propagate globally. Component-level hardcoded colors are handled in Phase 3 unless they cannot be fixed by token changes alone.

**Scope:**
- Adjust `--muted-foreground` lightness in dark mode for 4.5:1+ contrast on `--muted`
- Increase `--card` lightness in dark mode to be distinguishable from `--background`
- Verify `--border` visibility in dark mode
- Verify focus ring visibility in both light and dark themes
- Document approved opacity values for text hierarchy

**Out of scope:**
- Component-level hardcoded colors (Phase 3)
- New theme architecture or color space migration
</domain>

<decisions>
## Implementation Decisions

### Color Space Strategy
- **D-01:** Keep HSL color space for now
- Fix token values in HSL to achieve WCAG compliance
- Plan OKLCH migration as a separate future effort
- Use color2k for contrast verification during this phase

### Contrast Target Levels
- **D-02:** Primary text: WCAG AAA (~7:1 contrast ratio)
- **D-03:** Card background: WCAG AA minimum (4.5:1 on background)
- Token adjustments should achieve these targets in dark mode

### Token vs Component Fixes
- **D-04:** Fix all issues that can be fixed at the token level in Phase 2
- If a hardcoded color can be replaced with a theme token, do it in Phase 2
- Only defer to Phase 3 if component-level refactoring is required beyond token swaps
- This may reduce Phase 3 scope to primarily complex component changes

### Focus Ring Implementation
- **D-05:** Verify focus ring visibility first
- Test current `--ring` token value across different backgrounds
- If insufficient, adjust `--ring` token lightness/spread
- Goal: visible focus indicator in both light and dark themes

### Claude's Discretion
- Exact HSL values for each token after color2k verification
- Specific `--card` target value (should be ~17% lightness in dark mode for 4.5:1)
- Focus ring spread and offset values if adjustments needed
- How to handle borderline cases (e.g., `--muted` on `--background` at ~4:1)
</decisions>

<canonical_refs>
## Canonical References

### Audit Findings (Phase 1)
- `.planning/phases/01-audit-and-measurement/audit/04-contrast-ratios.md` — Baseline contrast ratios, Phase 2 targets
- `.planning/phases/01-audit-and-measurement/audit/01-muted-foreground-audit.md` — 22 muted-foreground opacity violations
- `.planning/phases/01-audit-and-measurement/audit/02-dark-mode-modifiers-audit.md` — Dark mode modifier patterns
- `.planning/phases/01-audit-and-measurement/audit/03-hardcoded-colors-audit.md` — Hardcoded color findings

### Requirements
- `.planning/REQUIREMENTS.md` — A11Y-05 through A11Y-09 (token correction requirements)

### State
- `.planning/STATE.md` — Prior decisions: color2k for verification, HSL to OKLCH migration deferred

### Code
- `uno.config.ts` — Theme token definitions (lines 108-196 for light/dark values)
- `src/hooks/useTheme.ts` — Theme management hook
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `color2k` library: Already installed, can calculate exact contrast ratios
- `cn()` utility: `src/utils/cn.ts` — Class merging utility
- Existing token definitions in `uno.config.ts`

### Established Patterns
- CSS variables in `uno.config.ts` preflights define theming
- `--muted-foreground` currently at 65.1% lightness (dark mode) — needs ~75%+ for 4.5:1
- `--card` currently identical to `--background` at 4.9% lightness — needs distinct value

### Integration Points
- UnoCSS presetUno generates utility classes from CSS variables
- Changes to `--muted`, `--muted-foreground`, `--card`, `--border`, `--ring` affect all components using these tokens
</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.
</deferred>

---

*Phase: 02-token-value-corrections*
*Context gathered: 2026-03-27*
