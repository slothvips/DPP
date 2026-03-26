# Architecture: Browser Extension Theme Contrast Integration

**Project:** DPP - Browser Extension Theme Contrast Improvement
**Domain:** Architecture
**Researched:** 2026-03-27
**Confidence:** MEDIUM

## Executive Summary

The theme system uses **CSS custom properties (variables)** defined in `uno.config.ts` preflights, which UnoCSS transforms into utility classes. Theme tokens follow Shadcn UI conventions with semantic color names (`background`, `foreground`, `muted`, `muted-foreground`, etc.). The contrast improvement task is a **token value change only**, not a structural or component architecture change. The primary integration point is `uno.config.ts`, with secondary adjustments to component-specific inline styles.

## Theme Architecture Overview

### Current Architecture

```
uno.config.ts (preflights)
    └── CSS custom properties (--background, --foreground, --muted, etc.)
            │
            ├── UnoCSS utilities (bg-background, text-foreground, border-input)
            │       │
            │       └── Shadcn components via className props
            │
            └── Direct CSS variable usage (hsl(var(--x)))
                    │
                    └── Component inline styles (rare)
```

### Theme Token Layers

| Layer | Location | Purpose | Contrast Fix Scope |
|-------|----------|---------|-------------------|
| **CSS Variables** | `uno.config.ts` preflights | Define all semantic colors for light/dark | PRIMARY TARGET - adjust HSL values |
| **UnoCSS Preset** | `presetUno()` | Generates Tailwind-compatible utilities | No change needed |
| **Utility Classes** | Component className props | Apply theme colors | No structural change |
| **Radix Primitives** | `@radix-ui/react-*` | Accessible UI primitives | No structural change |

## Component Boundaries

### What Stays the Same

| Component | Boundary | Impact |
|-----------|----------|--------|
| All Shadcn UI components (`src/components/ui/`) | Use utility classes | No change to component code |
| Feature views (`src/features/*/`) | Use Shadcn components | No change to feature logic |
| `useTheme` hook (`src/hooks/useTheme.ts`) | Manages theme state | No change needed |
| `cn()` utility (`src/utils/cn.ts`) | Class merging | No change needed |
| Radix UI primitives | Used as-is | No structural change |

### What Changes

| Token | Location | Change Type | Risk |
|-------|----------|-------------|------|
| `--muted-foreground` | `uno.config.ts` line 165 | HSL value adjustment | LOW - targeted semantic change |
| `--secondary-foreground` | `uno.config.ts` line 163 | HSL value adjustment (if needed) | LOW |
| `--accent-foreground` | `uno.config.ts` line 167 | HSL value adjustment (if needed) | LOW |
| Any inline `opacity-` utilities | Feature components | Adjust if contrast still insufficient | LOW |

## Data Flow for Theme Application

```
User toggles theme
    │
    ▼
useTheme.ts: setTheme(newTheme)
    │
    ▼
updateSetting('theme', newTheme) → Dexie IndexedDB
    │
    ▼
useLiveQuery re-renders → useTheme returns new theme
    │
    ▼
useEffect: document.documentElement.classList.toggle('dark')
    │
    ▼
CSS: .dark { --muted-foreground: NEW_VALUE; ... }
    │
    ▼
All components using text-muted-foreground update automatically
```

## Contrast Analysis

### WCAG AA Requirements

| Text Type | Minimum Ratio | Target |
|-----------|---------------|--------|
| Normal text (< 18pt regular or < 14pt bold) | 4.5:1 | 4.5:1 or higher |
| Large text (>= 18pt regular or >= 14pt bold) | 3:1 | 3:1 or higher |
| UI components and graphical objects | 3:1 | 3:1 or higher |

### Current Dark Mode Contrast Ratios (Estimated)

| Token Pair | Background | Foreground | Ratio | Status |
|------------|------------|------------|-------|--------|
| `foreground` on `background` | 4.9% l | 98% l | ~15:1 | PASS |
| `primary-foreground` on `primary` | 59.8% l | 11.2% l | ~7:1 | PASS |
| `secondary-foreground` on `secondary` | 17.5% l | 98% l | ~8:1 | PASS |
| `accent-foreground` on `accent` | 17.5% l | 98% l | ~8:1 | PASS |
| `muted-foreground` on `muted` | 17.5% l | 65.1% l | ~3.5:1 | BORDERLINE - fails AA for normal text |
| `destructive-foreground` on `destructive` | 30.6% l | 98% l | ~7:1 | PASS |
| `card-foreground` on `card` | 4.9% l | 98% l | ~15:1 | PASS |
| `popover-foreground` on `popover` | 4.9% l | 98% l | ~15:1 | PASS |

**Primary Issue:** `--muted-foreground` at 65.1% lightness on `--muted` at 17.5% lightness yields approximately 3.5:1, which fails WCAG AA for normal text (requires 4.5:1).

## Integration Points

### 1. Primary: `uno.config.ts` (lines 153-196)

```typescript
.dark {
  --muted-foreground: 215 20.2% 65.1%;  // CURRENT - fails AA
  // Recommended: increase lightness to ~75%+ for 4.5:1+
  --muted-foreground: 215 15% 75%;
}
```

**Approach:** Adjust HSL values directly in the `.dark` block. No component code changes required.

### 2. Secondary: Component-specific inline styles

If token-level changes are insufficient, look for hardcoded opacity or inline styles in:

| File | Pattern | Example |
|------|---------|---------|
| `src/features/*/components/*.tsx` | `opacity-50`, `opacity-70` | Icon opacity, chevron arrows |

### 3. Tertiary: Sticky note colors

The sticky note palette (`--sticky-*` tokens) may need contrast checks in dark mode:

| Token | Light | Dark |
|-------|-------|------|
| `--sticky-yellow` | 92% l | 30% l |
| `--sticky-blue` | 95% l | 30% l |
| `--sticky-green` | 92% l | 30% l |

The dark mode sticky colors are muted (30% lightness) for a softer appearance. If text contrast is insufficient, increase to 40-45% lightness.

## Build Order Implications

### Phase 1: Token Adjustment (Low Risk)
1. Modify `--muted-foreground` in `uno.config.ts` dark mode
2. Verify with `pnpm dev` - all components using `text-muted-foreground` update automatically
3. No component rebuilds required

### Phase 2: Verification & Iteration (If Needed)
1. Check all uses of `text-muted-foreground` in codebase
2. Test with accessibility tools (browser DevTools contrast checker)
3. If still insufficient, adjust `--secondary-foreground` or `--accent-foreground`

### Phase 3: Sticky Note Validation (If Needed)
1. Test sticky note text contrast in dark mode
2. Adjust `--sticky-*` lightness values if text is hard to read

## Anti-Patterns to Avoid

### 1. Creating New Contrast Tokens
**Bad:** Adding `--muted-foreground-high-contrast` alongside existing `--muted-foreground`
**Why:** Fragments the token system, requires component code changes
**Instead:** Adjust the existing `--muted-foreground` value

### 2. Inline Style Overrides
**Bad:** `<p className="text-muted-foreground" style={{ color: '#xxx' }}>`
**Why:** Breaks theme consistency, hard to maintain
**Instead:** Fix the CSS variable value

### 3. Component-Specific Dark Mode Classes
**Bad:** Adding `.dark .special-text { color: #xxx }` in component files
**Why:** Scatters theme logic across components
**Instead:** Keep all theme values in `uno.config.ts` preflights

## Scalability Considerations

### At Current Scale (Single Extension)
- Token changes in `uno.config.ts` propagate globally
- No build optimization needed

### If Themes Expand
Consider extracting theme tokens to a separate file:
```
src/config/themes/
  ├── tokens.ts (all CSS variable definitions)
  └── uno.config.ts imports from tokens.ts
```

This allows per-theme token files and easier maintenance.

## Summary

| Aspect | Finding |
|--------|---------|
| **Integration Point** | `uno.config.ts` preflights only |
| **New Components** | None required |
| **Modified Components** | None required |
| **Risk** | LOW - CSS variable value adjustment |
| **Build Impact** | None - hot reload works with CSS variable changes |
| **Test Strategy** | Visual verification + browser accessibility tools |

## Sources

- UnoCSS theme configuration: `uno.config.ts` (analyzed)
- Shadcn UI theme pattern: `src/components/ui/*` (analyzed)
- WCAG contrast requirements: Web Content Accessibility Guidelines 2.1
- CSS variable theming: Tailwind CSS custom properties pattern

---

*Architecture research: 2026-03-27*
