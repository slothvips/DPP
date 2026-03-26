# Pitfalls Research

**Domain:** Browser Extension Theme Contrast Improvement
**Researched:** 2026-03-27
**Confidence:** MEDIUM

## Critical Pitfalls

### Pitfall 1: Opacity Stacking on Muted Text

**What goes wrong:**
Text using muted-foreground with opacity modifiers (e.g., `text-muted-foreground/60`) becomes unreadable in dark mode. The HSL lightness value of 65.1% on a dark background (4.9% lightness) fails WCAG AA contrast requirements.

**Why it happens:**
Developers use opacity modifiers to create visual hierarchy, but in dark mode, the `--muted-foreground` is already a light color (65.1% lightness). Adding 40-70% opacity makes it blend with the background, dropping contrast below 3:1.

**How to avoid:**
- Audit all uses of muted-foreground with opacity modifiers
- Create dedicated CSS variables for low-priority text (e.g., `--muted-foreground-subtle`)
- Prefer semantic color roles over opacity manipulation for hierarchy

**Warning signs:**
- grep finds `muted-foreground/[0-9]+` in component code
- Visual inspection reveals "faded" text in dark mode
- Automated contrast check fails on muted text

**Phase to address:**
Phase 1 (Audit & Measurement) - must identify all instances before changing values

---

### Pitfall 2: Hardcoded Dark Mode Modifier Classes

**What goes wrong:**
Components using `dark:` prefix classes for backgrounds (e.g., `dark:bg-muted/80`) may have incorrect contrast ratios. The `/80` opacity means the background only partially covers the surface, and if the muted color is similar to the actual background, contrast drops.

**Why it happens:**
Developers add dark mode variants with different opacity values "because it looked better" without checking contrast ratios. The light mode `/50` and dark mode `/80` are arbitrary choices.

**How to avoid:**
- Always verify dark mode color pairs have 4.5:1 contrast for text
- Document approved opacity values for each color role
- Use theme CSS variables consistently instead of arbitrary opacity

**Warning signs:**
- grep finds `dark:bg-[a-z]+/[0-9]+` patterns
- Dark mode backgrounds appear " washed out" or inconsistent
- Different components use different opacity values for same semantic role

**Phase to address:**
Phase 1 (Audit & Measurement) - baseline existing dark mode colors

---

### Pitfall 3: One-Time Color Hardcoding in Components

**What goes wrong:**
Features like Jenkins status indicators, recorder event types, and AI assistant messages use inline color classes (e.g., `bg-blue-500`, `text-green-600`) that may work in light mode but become invisible or jarring in dark mode.

**Why it happens:**
Developers pick colors that look good in their current theme without testing dark mode. These hardcoded Tailwind classes bypass the theme CSS variables entirely.

**How to avoid:**
- Replace hardcoded color classes with theme-aware color tokens
- Create semantic color variables for status states (e.g., `--status-success`, `--status-error`)
- Add `dark:` variants ONLY after verifying contrast ratios

**Warning signs:**
- grep finds `bg-[a-z]+-[0-9]+` (e.g., `bg-blue-500`) in feature components
- grep finds hardcoded hex values in component files
- Dark mode shows inconsistent or missing status colors

**Phase to address:**
Phase 2 (Component Hardening) - systematically replace hardcoded colors

---

### Pitfall 4: Inconsistent Muted-Foreground Values Across Components

**What goes wrong:**
Some components use `text-muted-foreground` directly while others use `text-muted-foreground/70` or `dark:text-muted-foreground/60`. This creates visual inconsistency where "same importance" text has different opacity.

**Why it happens:**
No documented standard for when to use opacity modifiers on muted-foreground. Developers guess or copy from existing code.

**How to avoid:**
- Define explicit text hierarchy in theme variables: `--text-primary`, `--text-secondary`, `--text-muted`
- Remove opacity modifiers from theme colors; handle hierarchy through semantic variable selection
- Create lint rule to flag improper muted-foreground usage

**Warning signs:**
- Visual inconsistency between similar UI elements
- grep finds mixed usage: `muted-foreground` and `muted-foreground/[0-9]+` in same file
- No documentation on when to use each variant

**Phase to address:**
Phase 1 (Audit & Measurement) - establish standards before Phase 2

---

### Pitfall 5: Border Color Contrast Failure

**What goes wrong:**
Border colors defined as `--border: 217.2 32.6% 17.5%;` in dark mode are too subtle. On a dark background (4.9% lightness), a 17.5% lightness border provides almost no visual separation.

**Why it happens:**
Border colors are often overlooked in contrast audits. The default border is designed for light mode legibility and simply not adapted for dark backgrounds.

**How to avoid:**
- Increase dark mode border lightness to at least 25-30%
- Consider separate `--border-strong` for emphasis borders that need more contrast
- Test borders on both light and dark backgrounds

**Warning signs:**
- grep finds `border-[a-z-]+` in components
- Dark mode UI appears to have "invisible" borders
- Cards and sections appear to merge together

**Phase to address:**
Phase 1 (Audit & Measurement) - identify all border usages first

---

### Pitfall 6: Shadcn Component Override Confusion

**What goes wrong:**
Shadcn UI components have their own color handling. When UnoCSS theme variables are updated, shadcn components may not pick up changes, or may have hardcoded values that conflict.

**Why it happens:**
Shadcn components reference theme CSS variables but some internal states (hover, active, disabled) have component-level styles that may not respect theme changes.

**How to avoid:**
- Check shadcn component source for hardcoded color values
- Override shadcn component styles using UnoCSS theme, not inline styles
- Test all component states (hover, focus, disabled) in both themes

**Warning signs:**
- Component looks correct in light mode but has issues in dark mode
- Hover states don't change color as expected
- Focus rings invisible in one theme

**Phase to address:**
Phase 2 (Component Hardening) - verify shadcn components after theme variable updates

---

### Pitfall 7: Focus Ring Visibility

**What goes wrong:**
Focus rings defined as `--ring: 224.3 76.3% 48%;` in dark mode may be too bright or too subtle depending on the background. Blue ring on dark blue background provides insufficient differentiation.

**Why it happens:**
Ring color is set independently of background. In dark mode, a blue ring on a slightly lighter blue background may be invisible.

**How to avoid:**
- Ensure ring color contrasts with both light AND dark backgrounds
- Consider theme-specific ring colors
- Test focus visibility with keyboard navigation (not just mouse)

**Warning signs:**
- Users report inability to see focus states
- Accessibility audit flags focus contrast
- Ring color similar to primary background color

**Phase to address:**
Phase 1 (Audit & Measurement) - include focus states in contrast audit

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Using opacity modifiers for hierarchy | Quick visual hierarchy | Contrast failures; inconsistent across themes | Never - creates maintenance burden |
| Copying existing component colors | Speed | Hardcoded values proliferate; no central control | Only when creating NEW semantic colors with documented purpose |
| Skipping dark mode testing | Faster initial development | Accessibility violations; user complaints | Only for truly internal MVP features |
| Using `dark:` variant without contrast check | Easy dark mode support | May look okay but fail accessibility | Only after verified with contrast tool |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| UnoCSS presetUno + Shadcn | UnoCSS preflight conflicts with Shadcn reset styles | Load UnoCSS before component styles; verify cascade |
| CSS variables + rrweb player | rrweb player uses its own theme CSS, ignores extension theme | Override rrweb theme variables in player entrypoint CSS |
| Browser extension devtools | Theme looks different in devtools popup vs sidepanel | Test in actual extension context, not devtools |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Excessive CSS variable overrides | Larger CSS bundle; flash of unstyled content | Use single source of truth; minimal overrides | At 500+ CSS variable declarations |
| Runtime theme switching overhead | Theme change causes visible re-render flicker | Apply theme class at document root, not per-component | Rapid theme toggling (e.g., system preference changes) |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing theme preference in localStorage without validation | Invalid theme values cause runtime errors | Validate theme values; use TypeScript union type |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| System theme doesn't match OS | User expects dark mode, extension stays light | Proper `prefers-color-scheme` listener (already implemented) |
| Theme toggle not persisted | User preference lost on reload | localStorage persistence (already implemented) |
| Contrast looks good in one theme, bad in another | User may only use one theme | Test BOTH light and dark mode comprehensively |
| Status colors look identical in dark mode | Cannot distinguish success/warning/error | Verify status color differentiation in both themes |

---

## "Looks Done But Isn't" Checklist

- [ ] **Muted text:** All `text-muted-foreground` instances tested at 100% opacity, verify contrast
- [ ] **Opacity modifiers:** Any `text-muted-foreground/[0-9]+` replaced with semantic alternatives
- [ ] **Hardcoded colors:** All `bg-[color]-[number]` replaced with theme tokens
- [ ] **Border contrast:** All borders visible and distinguishable in dark mode
- [ ] **Focus rings:** Keyboard navigation focus visible in both themes
- [ ] **Status colors:** Success/warning/error/info distinguishable in both themes
- [ ] **Hover states:** Interactive elements show clear hover feedback in both themes
- [ ] **Shadcn components:** All component states (hover, active, disabled, focus) tested
- [ ] **rrweb player:** Player theme matches extension theme
- [ ] **WCAG AA compliance:** Automated check passes (4.5:1 normal text, 3:1 large text)

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Opacity stacking | MEDIUM | Create semantic text hierarchy variables; audit all text color usages; update components to use new variables |
| Hardcoded colors | HIGH | Identify all hardcoded colors; create semantic theme variables; migrate components systematically |
| Border contrast | LOW | Update `--border` lightness value in dark mode; test across all components |
| Focus ring visibility | MEDIUM | Adjust `--ring` color; add focus-visible styles; test with keyboard navigation |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Opacity stacking on muted text | Phase 1: Audit & Measurement | grep for muted-foreground opacity usage; verify contrast ratios |
| Hardcoded dark mode modifiers | Phase 1: Audit & Measurement | grep for dark:bg-*/[0-9]+ patterns; compare to approved palette |
| Hardcoded colors in components | Phase 2: Component Hardening | grep for bg-[a-z]+-[0-9]+; verify all replaced with theme tokens |
| Inconsistent muted-foreground | Phase 1: Audit & Measurement | Document text hierarchy; grep for mixed usage |
| Border contrast | Phase 1: Audit & Measurement | Visual inspection; automated contrast check on borders |
| Shadcn override confusion | Phase 2: Component Hardening | Test all component states; verify theme variable inheritance |
| Focus ring visibility | Phase 1: Audit & Measurement | Keyboard navigation test; contrast check on focus elements |

---

## Sources

- [WCAG 2.1 Contrast Requirements](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html) - Official accessibility guidelines
- [Tailwind CSS Custom Colors](https://tailwindcss.com/docs/customizing-colors) - Color spacing and contrast considerations
- [Shadcn UI Theming](https://ui.shadcn.com/docs/theming) - Component theming patterns (unverified due to fetch restrictions)
- [UnoCSS presetUno](https://unocss.dev/presets/uno) - Theme preset documentation (unverified due to fetch restrictions)
- Codebase analysis: `uno.config.ts` (lines 108-196) - Existing theme variable definitions
- Codebase patterns: grep results for `dark:` modifier usage across feature components

---

*Pitfalls research for: Browser Extension Theme Contrast*
*Researched: 2026-03-27*
