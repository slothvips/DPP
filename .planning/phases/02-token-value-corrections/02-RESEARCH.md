# Phase 2: Token Value Corrections - Research

**Researched:** 2026-03-27
**Domain:** CSS Token Engineering for WCAG AA Contrast Compliance
**Confidence:** HIGH

## Summary

Phase 2 focuses on fixing CSS variable values in `uno.config.ts` to achieve WCAG AA compliance. The primary issues are in dark mode where `--muted-foreground` (~3.5:1 contrast) and `--card` (1:1 - identical to background) fail requirements. Using HSL color space with color2k for verification, we need to adjust lightness values for 5 tokens while maintaining light mode compliance (which already passes).

**Primary recommendation:** Increase `--muted-foreground` lightness from 65.1% to ~75%+ and make `--card` distinguishable from `--background` at ~17% lightness. Verify `--border` and `--ring` visibility through visual inspection.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Keep HSL color space for now (migrate to OKLCH later)
- Primary text: WCAG AAA (~7:1 contrast ratio)
- Card background: WCAG AA minimum (4.5:1 on background)
- Fix all issues that can be fixed at token level in Phase 2
- Focus ring: verify visibility first, then adjust if needed

### Claude's Discretion
- Exact HSL values for each token after color2k verification
- Specific `--card` target value (should be ~17% lightness in dark mode for 4.5:1)
- Focus ring spread and offset values if adjustments needed
- How to handle borderline cases (e.g., `--muted` on `--background` at ~4:1)

### Deferred Ideas (OUT OF SCOPE)
- Component-level hardcoded colors (Phase 3)
- New theme architecture or color space migration
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| UnoCSS | 66.6.0 | Atomic CSS engine | Theme tokens defined in preflights |
| color2k | 2.0.3 | Contrast ratio calculation | Already installed, OKLCH support |

### No Additional Dependencies
All work uses existing `uno.config.ts` structure and installed color2k library.

## Architecture Patterns

### Recommended Project Structure
```
uno.config.ts (lines 108-196)
├── :root { }           → Light mode tokens
└── .dark { }           → Dark mode tokens
```

### Token Value Adjustment Pattern
**What:** Modify HSL lightness (L%) values in dark mode preflight
**When to use:** For `--muted-foreground`, `--card`, `--border`, `--ring`
**Example (current):**
```css
.dark {
  --muted-foreground: 215 20.2% 65.1%;  /* ~3.5:1 on --muted */
  --card: 222.2 84% 4.9%;               /* identical to background */
}
```
**Example (target):**
```css
.dark {
  --muted-foreground: 215 20.2% 75%;     /* ~4.5:1+ on --muted */
  --card: 222.2 84% 17%;                 /* distinguishable from background */
}
```

### WCAG Contrast Calculation
**Formula:** Use color2k `contrast()` function
```typescript
import { contrast } from 'color2k';
// contrast('#color1', '#color2') returns ratio like 4.5
```

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| A11Y-05 | Adjust `--muted-foreground` lightness in dark mode to achieve 4.5:1 on `--muted` background | Baseline: 65.1% l yields ~3.5:1; target: 75%+ l |
| A11Y-06 | Increase `--border` lightness in dark mode for visible separation on `--background` | Baseline: 25% l yields ~5:1; verify visibility |
| A11Y-07 | Verify focus ring visibility in both light and dark themes | Current ring: 224.3 76.3% 48%; needs visual verification |
| A11Y-08 | Ensure `--card` background distinguishes from `--background` in dark mode | Current: 4.9% l (1:1); target: 17%+ l for visual distinction |
| A11Y-09 | Document approved opacity values for text hierarchy | Current pattern uses opacity modifiers; documentation needed |

## Token Adjustments Required

### 1. --muted-foreground (Dark Mode) - A11Y-05

**Current value:** `215 20.2% 65.1%`
**Background:** `--muted` at `217.2 32.6% 17.5%`
**Current contrast:** ~3.5:1 (FAIL - needs 4.5:1)

**Calculation for target:**
- Target: 4.5:1 contrast ratio
- Using color2k: `luminance` + `contrast` functions
- Rough estimate: Need ~75% lightness for 4.5:1

**Recommended value:** `215 20.2% 75%` (or verify with color2k)

### 2. --card (Dark Mode) - A11Y-08

**Current value:** `222.2 84% 4.9%` (identical to `--background`)
**Background:** `--background` at `222.2 84% 4.9%`
**Current contrast:** 1:1 (FAIL - no distinction)

**Recommendation:** `222.2 84% 17%` (or similar - distinguishable at ~3:1+)
- Target is visual distinction, not full AA text contrast
- Per context: "should be ~17% lightness in dark mode for 4.5:1"

### 3. --border (Dark Mode) - A11Y-06

**Current value:** `217.2 32.6% 25%` (same as `--muted`)
**Background:** `--background` at `222.2 84% 4.9%`
**Current contrast:** ~5:1 (PASSES AA)

**Verification needed:** Visual inspection to confirm borders are visible
- If borders appear too faint, increase lightness slightly
- No change may be needed if visible

### 4. --ring (Dark Mode) - A11Y-07

**Current value:** `224.3 76.3% 48%`
**Issue:** Blue-ish ring may not be visible on all backgrounds

**Verification:**
1. Start dev server: `pnpm dev`
2. Inspect focus states on buttons, inputs across light/dark themes
3. If invisible: adjust to higher contrast value (e.g., increase lightness toward 60%+)

**No predetermined change** - verify first per D-05

### 5. Text Hierarchy Opacity Documentation - A11Y-09

**Current issue:** Components use opacity modifiers like `text-muted-foreground/70`
**Impact:** Compounds contrast issues in dark mode

**Recommendation:**
- Document that opacity modifiers below 100% on `--muted-foreground` are DISCOURAGED in dark mode
- Base token should provide sufficient contrast without modifiers

**Approved hierarchy (draft):**
| Level | Token | Light Mode | Dark Mode | Notes |
|-------|-------|------------|-----------|-------|
| Primary | `--foreground` | 4.9% l | 98% l | Always 100% |
| Secondary | `--secondary-foreground` | 11.2% l | 98% l | Always 100% |
| Muted | `--muted-foreground` | 46.9% l | 75%+ l | After fix, no opacity needed |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Contrast calculation | Custom luminance formula | `color2k.contrast()` | Handles edge cases, tested |
| Color conversion | Manual HSL/OKLCH math | `color2k.toOKLCH()` | Perceptually accurate |

**Key insight:** color2k is already installed and handles all color space conversions and contrast calculations correctly.

## Common Pitfalls

### Pitfall 1: Adjusting tokens without verification
**What goes wrong:** Token changes look good on paper but fail visual inspection
**Why it happens:** Contrast ratios are theoretical; human perception differs
**How to avoid:** Run `pnpm dev`, visually inspect each changed token on real components
**Warning signs:** Changes pass color2k but look wrong in browser

### Pitfall 2: Breaking light mode while fixing dark mode
**What goes wrong:** Dark mode passes but light mode fails
**Why it happens:** Light mode values were unchanged but could be affected by HSL math
**How to avoid:** Verify light mode unchanged (should already pass at 15:1+ for most pairs)
**Warning signs:** Any lightness increase could reduce contrast in light mode

### Pitfall 3: Focus ring changes affect other components
**What goes wrong:** Changing `--ring` token affects all ring-style decorations
**Why it happens:** `--ring` is used for focus indicators AND potentially other borders
**How to avoid:** Verify ring changes in isolation, check all ring usages
**Warning signs:** Unexpected border color changes on non-focus elements

## Code Examples

### Using color2k for verification (reference)
```typescript
import { contrast, toOKLCH } from 'color2k';

// Calculate contrast between two colors
const ratio = contrast('#ffffff', '#000000'); // returns 21

// Convert HSL to OKLCH for perceptual calculation
const oklch = toOKLCH('hsl(215 20.2% 75%)');
```

### uno.config.ts dark mode token structure (lines 153-196)
```typescript
.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  --card: 222.2 84% 4.9%;           // ← needs distinct value
  --card-foreground: 210 40% 98%;
  // ... other tokens
  --muted: 217.2 32.6% 17.5%;
  --muted-foreground: 215 20.2% 65.1%; // ← needs 75%+
  // ... other tokens
  --border: 217.2 32.6% 17.5%;        // ← verify visibility
  --ring: 224.3 76.3% 48%;           // ← verify visibility
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded opacity modifiers | Token-level contrast | Phase 2 | Fixes 22 instances |
| Identical card/background | Distinct card value | Phase 2 | Cards visible |

**Deprecated/outdated:**
- Opacity modifiers on muted-foreground: DISCOURAGED after Phase 2 fix

## Open Questions

1. **Exact --muted-foreground lightness target**
   - What we know: 75% should yield ~4.5:1
   - What's unclear: Exact value needs color2k verification
   - Recommendation: Start at 75%, verify with `color2k.contrast()`, adjust if needed

2. **Border visibility threshold**
   - What we know: ~5:1 contrast, should be visible
   - What's unclear: Whether 25% lightness appears too faint
   - Recommendation: Verify visually; if borderline, increase to 30%

3. **--muted on --background borderline case (~4:1)**
   - What we know: Currently ~4:1, needs 4.5:1
   - What's unclear: If this pair is actually used with text
   - Recommendation: Per D-04, fix at token level if possible; otherwise Phase 3

4. **Focus ring spread/offset adjustments**
   - What we know: Current ring is blue-ish at 48% lightness
   - What's unclear: Visibility on various backgrounds
   - Recommendation: Verify first per D-05; adjust only if confirmed invisible

## Sources

### Primary (HIGH confidence)
- `uno.config.ts` lines 108-196 - Current token definitions
- Phase 1 audit: `.planning/phases/01-audit-and-measurement/audit/04-contrast-ratios.md` - Baseline measurements
- `color2k` npm package v2.0.3 - Contrast calculation

### Secondary (MEDIUM confidence)
- Phase 1 audit: `.planning/phases/01-audit-and-measurement/audit/01-muted-foreground-audit.md` - 22 opacity modifier instances

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - UnoCSS is standard, color2k already installed
- Architecture: HIGH - Simple token value adjustment
- Pitfalls: HIGH - Well-documented with clear prevention

**Research date:** 2026-03-27
**Valid until:** 30 days (stable domain)
