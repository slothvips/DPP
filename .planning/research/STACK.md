# Stack Research

**Domain:** CSS Contrast Optimization for React + UnoCSS + Shadcn UI
**Researched:** 2026-03-27
**Confidence:** MEDIUM (based on training data, unable to verify with official docs due to network restrictions)

## Executive Summary

Improving CSS contrast in your stack requires shifting from HSL to **OKLCH color space** for perceptual uniformity, adding a contrast-checking utility (recommended: **color2k**), and leveraging CSS's modern color functions. The current HSL-based theme system works but makes it difficult to guarantee WCAG AA compliance because HSL is not perceptually uniform.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **color2k** | ^2.0.0 | Contrast ratio calculation | Tiny (1.6KB), includes `contrast()` and `contrastAA()` functions, supports OKLCH natively |
| **CSS oklch()** | Native | Perceptually uniform colors | Modern browsers support it; enables mathematically predictable contrast |

### Supporting Libraries

| Library | Purpose | When to Use |
|---------|---------|-------------|
| **poline** | OKLCH palette generation | If you need to generate entire color scales with guaranteed contrast |
| **@radix-ui/colors** | Semantic color scales | Reference for how Shadcn/radix generates accessible dark mode palettes |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **Browser DevTools** | Manual contrast inspection | Use color picker to verify contrast ratios |
| **axe DevTools** | Automated accessibility testing | Browser extension for catching contrast issues |

## Current Stack Analysis

### Existing Setup (from uno.config.ts)

```
- Colors defined as HSL: hsl(var(--variable))
- CSS variables: --primary, --muted-foreground, etc.
- Two themes: :root (light) and .dark
- Uses presetUno + Shadcn UI components
```

### Problem with Current HSL Approach

HSL is **not perceptually uniform**. Equal steps in HSL values do not equal equal perceptual differences. This makes it impossible to mathematically guarantee contrast ratios when generating color variants.

Example: `--muted-foreground: 215.4 16.3% 46.9%` in dark mode (on `--background: 222.2 84% 4.9%`) likely fails WCAG AA because the lightness (46.9%) is too close to the background lightness (4.9% appears reversed - this suggests the values may be incorrect or there's a misunderstanding).

### Recommended Migration Path

**Phase 1: Add contrast checking utility**

```bash
pnpm add color2k
```

**Phase 2: Convert CSS variables to OKLCH (gradual)**

Replace HSL with OKLCH for new or problematic color tokens:

```css
/* Before (HSL) */
--primary: 220 100% 30%;
--primary-foreground: 0 0% 100%;

/* After (OKLCH) - approximately equivalent */
--primary: oklch(45% 0.2 260);
--primary-foreground: oklch(97% 0 0);
```

## Color Format Recommendations

### Use OKLCH for New Color Tokens

OKLCH is the modern standard because:
- **Perceptually uniform**: Equal steps = equal perceived difference
- ** gamut-aware**: Cannot specify out-of-gamut colors
- **Human-readable**: Lightness first, then chroma (saturation), then hue

```css
--my-color: oklch(L% C H);
--primary: oklch(50% 0.15 250); /* 50% lightness, 15% chroma, 250 hue */
```

### Contrast Checking with color2k

```typescript
import { contrast } from 'color2k';

// Check contrast ratio
const ratio = contrast('#ffffff', '#000000'); // 21:1
const ratioAA = contrast('#ffffff', '#767686'); // ~4.5:1 for AA

// WCAG AA compliance
const passesAA = ratio >= 4.5; // Normal text
const passesAAA = ratio >= 7;  // Enhanced
```

### CSS Built-in Contrast Functions

For simple inversions, CSS `color-mix()` can help:

```css
/* Ensure foreground is readable on background */
--text-on-primary: color-mix(in oklch, var(--primary) 20%, white);
```

## Installation

```bash
# Contrast checking utility
pnpm add color2k
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|------------------------|
| color2k | chroma-js | If you need more color manipulation (chroma-js is larger but more feature-rich) |
| color2k | poline | Only if you need algorithmic palette generation, not just contrast checking |
| OKLCH | LCH | OKLCH is the modern successor; LCH is legacy CIELCH |
| OKLCH | HSL | Only if you need IE11 support (not relevant for extension) |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **chroma.js** | Large bundle size (30KB+), not OKLCH-native | color2k (1.6KB) |
| **postcss-color-mod-function** | Deprecated | Native CSS oklch() |
| **Accessibility scanners that only check sRGB** | May miss gamut issues | color2k with OKLCH input |

## Stack Patterns by Variant

**If contrast issues are isolated to specific components:**
- Use color2k to find the exact problematic token pairs
- Override only those specific CSS variables

**If rebuilding theme system entirely:**
- Migrate to OKLCH throughout
- Use poline to generate complete scales with guaranteed contrast

**If using Shadcn UI defaults:**
- The default Shadcn palette may already be accessible
- Verify with color2k; adjust only failing combinations

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| color2k@2.x | React 19, UnoCSS | Works in browser extensions |
| oklch() | Chrome 111+, Firefox 113+, Safari 16.4+ | All modern browsers |

## Implementation Notes for Your Stack

### UnoCSS Configuration

Modify `uno.config.ts` preflights to use OKLCH:

```typescript
preflights: [
  {
    getCSS: () => `
      :root {
        --primary: oklch(45% 0.18 260);
        --primary-foreground: oklch(97% 0.01 0);
        /* ... other tokens */
      }
      .dark {
        --primary: oklch(60% 0.18 260);
        --primary-foreground: oklch(15% 0.01 0);
        /* ... dark mode tokens - verify with color2k */
      }
    `,
  },
],
```

### Contrast Verification Script

Create a one-time script to verify all color combinations:

```typescript
import { contrast } from 'color2k';

const combinations = [
  { bg: '--background', fg: '--foreground' },
  { bg: '--primary', fg: '--primary-foreground' },
  { bg: '--muted', fg: '--muted-foreground' },
  // ... add all semantic combinations
];

// Log any combinations that fail WCAG AA (4.5:1)
combinations.forEach(({ bg, fg }) => {
  const ratio = contrast(getCSSVar(bg), getCSSVar(fg));
  if (ratio < 4.5) {
    console.warn(`${bg}/${fg} fails AA: ${ratio.toFixed(2)}:1`);
  }
});
```

## Sources

**Note:** Unable to verify with official docs due to network restrictions. Confidence levels below.

- color2k npm/package - LOW confidence (based on training data, not verified)
- OKLCH browser support - MEDIUM confidence (well-established standard)
- Radix UI color system - LOW confidence (based on general knowledge)
- UnoCSS color configuration - MEDIUM confidence (standard UnoCSS docs pattern)

---

*Stack research for: CSS Contrast Optimization*
*Researched: 2026-03-27*
