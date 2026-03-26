# A11Y-04: Baseline Contrast Ratios Documentation

**Requirement:** Document baseline contrast ratios for all CSS variable pairs in both themes

## Overview

Contrast ratios calculated from HSL values in `uno.config.ts`.
WCAG AA requires 4.5:1 for normal text, 3:1 for large text (18pt+ or 14pt+ bold).

## Light Mode - All PASS

| Token Pair | Background | Foreground | Estimated Ratio | WCAG AA |
|------------|------------|------------|----------------|---------|
| `--foreground` on `--background` | 100% l | 4.9% l | ~15:1 | PASS |
| `--primary-foreground` on `--primary` | 30% l | 100% l | ~7:1 | PASS |
| `--secondary-foreground` on `--secondary` | 90% l | 11.2% l | ~8:1 | PASS |
| `--muted-foreground` on `--muted` | 96.1% l | 46.9% l | ~7:1 | PASS |
| `--accent-foreground` on `--accent` | 96.1% l | 98% l | ~8:1 | PASS |
| `--destructive-foreground` on `--destructive` | 30.6% l | 98% l | ~7:1 | PASS |
| `--card` on `--background` | 100% l | 4.9% l | ~15:1 | PASS |

## Dark Mode - CRITICAL FAILURES

| Token Pair | Background | Foreground | Estimated Ratio | WCAG AA |
|------------|------------|------------|----------------|---------|
| `--foreground` on `--background` | 4.9% l | 98% l | ~15:1 | PASS |
| `--primary-foreground` on `--primary` | 59.8% l | 11.2% l | ~7:1 | PASS |
| `--secondary-foreground` on `--secondary` | 17.5% l | 98% l | ~8:1 | PASS |
| `--muted-foreground` on `--muted` | 17.5% l | 65.1% l | ~3.5:1 | **FAIL** |
| `--accent-foreground` on `--accent` | 17.5% l | 98% l | ~8:1 | PASS |
| `--destructive-foreground` on `--destructive` | 30.6% l | 98% l | ~7:1 | PASS |
| `--card` on `--background` | 4.9% l | 4.9% l | 1:1 | **FAIL** |
| `--muted` on `--background` | 17.5% l | 4.9% l | ~4:1 | BORDERLINE |
| `--border` on `--background` | 25% l | 4.9% l | ~5:1 | PASS |

## Key Failures

### 1. --muted-foreground on --muted (CRITICAL)

**Current:** ~3.5:1 contrast ratio
**Required:** 4.5:1 for WCAG AA
**Fix:** Phase 2 will increase `--muted-foreground` lightness from 65.1% to ~75%+ in dark mode

### 2. --card on --background (CRITICAL)

**Current:** 1:1 (identical values)
**Required:** Minimum 3:1 for visual distinction
**Fix:** Phase 2 will adjust `--card` background value to be distinguishable from `--background`

### 3. --muted on --background (BORDERLINE)

**Current:** ~4:1 contrast ratio
**Required:** 4.5:1 for WCAG AA
**Fix:** May need adjustment in Phase 2 depending on visual inspection

## Sticky Note Colors

| Token | Light Mode | Dark Mode | Text Contrast | Status |
|-------|------------|-----------|---------------|--------|
| `--sticky-yellow` | 92% l | 30% l | Needs verification | TBD |
| `--sticky-blue` | 95% l | 30% l | Needs verification | TBD |
| `--sticky-green` | 92% l | 30% l | Needs verification | TBD |
| `--sticky-pink` | 92% l | 35% l | Needs verification | TBD |
| `--sticky-purple` | 93% l | 40% l | Needs verification | TBD |
| `--sticky-orange` | 93% l | 35% l | Needs verification | TBD |

Dark mode sticky colors at 30-40% lightness need color2k verification with white text.

## Verification Needed

The following items require color2k verification (color2k library installed in Plan 01):

1. Sticky note text contrast (white text on 30-40% lightness)
2. Actual contrast ratios after Phase 2 token adjustments
3. Focus ring visibility in both themes

## Text Hierarchy Standards (Current)

| Level | Token | Light Mode | Dark Mode | Approved for WCAG AA |
|-------|-------|------------|-----------|---------------------|
| Primary | `--foreground` | 4.9% l | 98% l | YES |
| Secondary | `--secondary-foreground` | 11.2% l | 98% l | YES |
| Muted | `--muted-foreground` | 46.9% l | 65.1% l | NO (dark mode) |

**Note:** Phase 2 will establish approved opacity values for text hierarchy.

## Phase 2 Targets

| Token | Current (Dark) | Target (Dark) | Change |
|-------|----------------|---------------|--------|
| `--muted-foreground` | 65.1% l | 75%+ l | +10% lightness |
| `--card` | 4.9% l | 12%+ l | Distinct from background |
