# Project Research Summary

**Project:** Browser Extension Theme Contrast Improvement
**Domain:** Browser Extension UI Accessibility / CSS Contrast Optimization
**Researched:** 2026-03-27
**Confidence:** MEDIUM

## Executive Summary

This project focuses on fixing WCAG AA contrast failures in the DPP browser extension's dark mode theme. The extension uses UnoCSS with CSS variable theming following shadcn/ui patterns, where semantic tokens (--background, --foreground, --muted, etc.) are defined in `uno.config.ts`. The core issue is that the current HSL-based color system makes it mathematically difficult to guarantee contrast ratios, and several token values (particularly `--muted-foreground` at 65.1% lightness on `--muted` at 17.5% lightness) fail WCAG AA 4.5:1 requirements for normal text.

Research recommends two primary actions: First, migrate from HSL to OKLCH color space for perceptually uniform colors that enable mathematically predictable contrast. Second, add color2k as a contrast-checking utility to verify all color combinations against WCAG standards. The good news is this is a **low-risk token value change** - no component code modifications are required since all colors flow through CSS variables defined in `uno.config.ts`.

Key risks include opacity stacking (using `text-muted-foreground/60` patterns), hardcoded color classes in feature components (like `bg-blue-500`), and shadcn component internal styles that may not respect theme variable updates. The recommended approach is to audit all contrast-affecting patterns first, then systematically fix token values before addressing component-specific issues.

## Key Findings

### Recommended Stack

**Core technologies:**
- **color2k (^2.0.0):** Contrast ratio calculation — Tiny (1.6KB), includes `contrast()` and `contrastAA()` functions, supports OKLCH natively. Add via `pnpm add color2k`.
- **CSS oklch():** Perceptually uniform color space — Native to modern browsers (Chrome 111+, Firefox 113+, Safari 16.4+). Replaces HSL for color definitions in `uno.config.ts` preflights.
- **poline:** OKLCH palette generation — Optional, only needed if generating entire color scales with guaranteed contrast.

**Migration path:**
1. Add color2k as dev dependency
2. Create contrast verification script to identify failing token pairs
3. Convert problematic tokens from HSL to OKLCH incrementally
4. Verify with browser DevTools and axe DevTools

### Expected Features

**Must have (WCAG AA compliance):**
- All text achieves 4.5:1 contrast ratio minimum
- Muted text on muted backgrounds passes AA (currently fails at ~2.5:1)
- Borders visible in dark mode (17.5% lightness on 4.9% background is invisible)
- Focus rings visible in both light and dark themes

**Should have (quality improvements):**
- Card background distinguishes from page background in dark mode
- Sticky note colors (--sticky-*) have sufficient text contrast
- Input placeholder text is readable
- Status colors (success/warning/error) distinguishable in both themes

**Defer (v2+):**
- AAA compliance for enhanced accessibility
- Custom theme editor for user-defined palettes
- High contrast mode beyond WCAG AA

### Architecture Approach

The theme system is a **single integration point** with no structural changes needed. CSS variables are defined in `uno.config.ts` preflights and flow through to all components via UnoCSS utilities.

**Major components:**
1. **uno.config.ts preflights** — Define all semantic color tokens for light/dark modes. PRIMARY TARGET for contrast fixes.
2. **Shadcn UI components** — Use utility classes (e.g., `text-muted-foreground`), no component code changes needed
3. **Feature views** — Consume shadcn components; may have inline hardcoded colors that need audit
4. **rrweb player** — Has separate theme CSS, requires override in player entrypoint to match extension theme

### Critical Pitfalls

1. **Opacity stacking on muted text** — Using `text-muted-foreground/60` in dark mode causes contrast to fall below 3:1. Solution: Audit all opacity modifier usages, create dedicated semantic text hierarchy variables.

2. **Hardcoded dark mode modifiers** — Arbitrary `dark:bg-*/[80]` values chosen without contrast verification. Solution: Always verify dark mode color pairs have 4.5:1 contrast, document approved opacity values.

3. **One-time color hardcoding in components** — Inline classes like `bg-blue-500` bypass theme system and become invisible in dark mode. Solution: Replace with theme tokens, create semantic status color variables.

4. **Border contrast failure** — Border color at 17.5% lightness on 4.9% background provides no visual separation. Solution: Increase dark mode border lightness to 25-30%.

5. **Shadcn component override confusion** — Shadcn internal states (hover, active, disabled) may have hardcoded values conflicting with theme updates. Solution: Test all component states, override using UnoCSS theme not inline styles.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Audit and Measurement
**Rationale:** Cannot fix what you cannot measure. Must identify all instances of contrast-affecting patterns before changing values.

**Delivers:**
- Complete grep audit of `muted-foreground/[0-9]+` patterns
- grep audit of `dark:bg-[a-z]+/[0-9]+` patterns
- grep audit of hardcoded colors (`bg-[a-z]+-[0-9]+`)
- Baseline contrast ratios for all token pairs
- Documented text hierarchy standards

**Avoids:** Making random fixes without understanding scope; fixing symptoms not causes

### Phase 2: Token Value Corrections
**Rationale:** Token changes in `uno.config.ts` propagate globally with zero component changes. This is the highest leverage fix.

**Delivers:**
- `--muted-foreground` adjusted in dark mode (increase lightness to ~75%+)
- `--border` darkness increased in dark mode (25-30% lightness)
- Focus ring visibility verified and corrected
- Approved opacity values documented

**Uses:** color2k for contrast verification

### Phase 3: Component Hardening
**Rationale:** After token-level fixes, systematically replace any remaining hardcoded colors in feature components.

**Delivers:**
- All `bg-[color]-[number]` replaced with theme tokens
- Status indicators use semantic variables
- Sticky note colors verified for contrast
- rrweb player theme override in place

**Implements:** Feature component color audit from FEATURES.md

### Phase 4: Verification and Polish
**Rationale:** Final accessibility verification before release.

**Delivers:**
- WCAG AA automated check passes
- All shadcn component states tested in both themes
- Keyboard navigation focus visible throughout
- "Looks Done But Isn't" checklist complete

### Phase Ordering Rationale

- Token fixes must come first because they are low-risk, high-impact, and require no component changes
- Component hardening follows because it requires more careful work (grep, replace, verify)
- Verification is last because it confirms the earlier phases worked
- Dependencies: Phase 1 informs Phase 2; Phase 2 enables Phase 3; Phase 3 feeds Phase 4

### Research Flags

Phases with standard patterns (skip research-phase):
- **Phase 2 (Token Value Corrections):** CSS variable adjustment is well-documented, established UnoCSS pattern

Phases likely needing deeper research during planning:
- **Phase 3 (Component Hardening):** Some feature components may have non-standard color usage requiring case-by-case decisions

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | color2k and OKLCH are well-established; unverified due to network restrictions |
| Features | MEDIUM | Based on codebase analysis; WCAG AA requirements are official standards |
| Architecture | HIGH | Single-file change in uno.config.ts, verified in codebase |
| Pitfalls | MEDIUM | Based on WCAG standards and common HSL/UnoCSS patterns |

**Overall confidence:** MEDIUM

### Gaps to Address

- **color2k API verification:** Unable to verify exact API signatures due to network restrictions. Validate color2k `contrast()` and `contrastAA()` function signatures before use.
- **Sticky note contrast:** The `--sticky-*` colors need on-device testing to verify dark mode text contrast.
- **Shadcn component internal states:** Some component states (hover, active) may have hardcoded values not captured in grep audit. Visual testing required.

## Sources

### Primary (HIGH confidence)
- UnoCSS theme configuration: `uno.config.ts` — Analyzed directly from codebase
- WCAG 2.1 Contrast Requirements: https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html — Official accessibility guidelines

### Secondary (MEDIUM confidence)
- Shadcn UI Theming: https://ui.shadcn.com/docs/theming — Based on training data, unverified due to network restrictions
- UnoCSS presetUno: https://unocss.dev/presets/uno — Standard UnoCSS documentation patterns
- Tailwind CSS Custom Colors: https://tailwindcss.com/docs/customizing-colors — Color spacing and contrast considerations

### Tertiary (LOW confidence)
- color2k npm/package — Based on training data, not verified; needs API validation before use
- Radix UI color system — General knowledge, specific values unverified

---
*Research completed: 2026-03-27*
*Ready for roadmap: yes*
