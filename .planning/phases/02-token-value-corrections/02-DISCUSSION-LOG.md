# Phase 2: Token Value Corrections - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 02-token-value-corrections
**Areas discussed:** Color space migration strategy, Exact contrast targets, Token-only vs component-level fixes, Focus ring implementation

---

## Color Space Migration Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Fix HSL values now, migrate later | Focus on WCAG compliance first. Migrate to OKLCH as a separate effort later. Lower risk, clearer scope. | ✓ |
| Migrate to OKLCH during Phase 2 | Do the migration now while we're already changing token values. Better long-term maintainability. | |
| Use color2k for verification, keep HSL | Just fix the HSL values to meet contrast targets. Don't migrate color spaces in this phase. | |

**User's choice:** Fix HSL values now, migrate later
**Notes:** Focus on WCAG compliance as the immediate goal. OKLCH migration can be planned separately.

---

## Exact Contrast Targets

### Question 1: Contrast target strictness

| Option | Description | Selected |
|--------|-------------|----------|
| WCAG AA minimum | Normal text 4.5:1, large text 3:1. Minimum viable target, lower risk. | |
| WCAG AAA enhanced | Higher contrast (~7:1). Better accessibility, but may impact visual design. | ✓ |
| Differentiate by element type | Primary text 4.5:1, secondary text 3:1. Balance accessibility and visual hierarchy. | |

**User's choice:** WCAG AAA enhanced standard (~7:1)
**Notes:** Aim for higher accessibility standard.

### Question 2: Card background distinction

| Option | Description | Selected |
|--------|-------------|----------|
| Minimum 3:1 (barely distinguishable) | Card 4.9% → ~12% lightness, achieves 3:1. Minimum change. | |
| Medium 4.5:1 (AA standard) | Card 4.9% → ~17% lightness, achieves 4.5:1. Balanced accessibility and aesthetics. | ✓ |
| High 7:1 (AAA standard) | Card 4.9% → ~30% lightness, high contrast with dark background. Clearer but larger visual difference. | |

**User's choice:** Medium 4.5:1 (AA standard)
**Notes:** Card should be distinguishable but not overly bright.

---

## Token-only vs Component-level Fixes

| Option | Description | Selected |
|--------|-------------|----------|
| Fix all fixable at token level | If a token can fix it, do it in Phase 2. Only defer to Phase 3 if component refactoring is truly needed beyond token swaps. | ✓ |
| Strict phase separation | Phase 2 only changes uno.config.ts values. Phase 3 handles hardcoded colors. Phase 2 doesn't touch component code. | |
| Handle together in Phase 2 | If hardcoded colors affect contrast, fix them in Phase 2 too. Phase 3 only handles more complex component refactoring. | |

**User's choice:** Fix all fixable at token level
**Notes:** This approach maximizes Phase 2 impact. Phase 3 scope may reduce to primarily complex component changes.

---

## Focus Ring Implementation

| Option | Description | Selected |
|--------|-------------|----------|
| Verify + token adjust | First test current ring value on different backgrounds. If not visible enough, adjust --ring value or spread. | ✓ |
| Always use high-contrast ring | Regardless of background, use a conspicuous ring (white or bright). Visible on both dark and light backgrounds. | |
| Adaptive per background | Ring color auto-adjusts based on current background (using OKLCH L value). Complex but most flexible. | |

**User's choice:** Verify + token adjust
**Notes:** Start by testing the current value, then make targeted adjustments if needed.

---

## Claude's Discretion

- Exact HSL values for each token after color2k verification
- Specific `--card` target value (~17% lightness for 4.5:1 in dark mode)
- Focus ring spread and offset values if adjustments needed
- Borderline cases handling (e.g., `--muted` on `--background` at ~4:1)

## Deferred Ideas

None mentioned during discussion.
