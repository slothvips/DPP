# Feature Landscape: Browser Extension Theme Contrast

**Domain:** Browser Extension UI Contrast Audit
**Researched:** 2026-03-27
**Confidence:** MEDIUM (codebase analysis + general web extension patterns)

## Executive Summary

This extension uses UnoCSS with CSS variable theming (HSL format) supporting light/dark/system modes. The theme system follows shadcn/ui patterns with standard tokens (--background, --foreground, --border, etc.). Common contrast issues in browser extensions with dual themes fall into four categories: text contrast, border contrast, background contrast, and icon contrast. Each shadcn component has specific vulnerability points.

## Categories of Contrast Issues

### 1. Text Contrast

| Component Area | Token Used | Typical Problem | Complexity |
|----------------|------------|-----------------|------------|
| Body text | `--foreground` | Already good in default config | Low |
| Muted text | `--muted-foreground` | Light mode: `215.4 16.3% 46.9%` (gray-500) may pass; Dark mode: `215 20.2% 65.1%` (gray-400) often fails | Medium |
| Placeholder text | `placeholder:text-muted-foreground` | Inherits muted-foreground; often fails WCAG 4.5:1 | Medium |
| Secondary text | `--secondary-foreground` | Dark mode on `--secondary` (17.5% lightness) should be 98% lightness - should pass | Low |
| Disabled text | `disabled:opacity-50` | Opacity reduction further reduces contrast | Low |

**WCAG Targets:**
- Normal text: 4.5:1 minimum
- Large text (18pt+): 3:1 minimum
- UI components (buttons, inputs): 4.5:1 minimum

### 2. Border Contrast

| Component Area | Token Used | Light Mode Value | Dark Mode Value | Risk |
|----------------|------------|------------------|-----------------|------|
| Default border | `--border` | `214.3 31.8% 91.4%` (light gray) | `217.2 32.6% 17.5%` (dark slate) | Medium |
| Input border | `--input` | Same as border | Same as border | Medium |
| Focus ring | `--ring` | `221.2 83.2% 53.3%` (blue) | `224.3 76.3% 48%` (blue) | Low |
| Dividers | `--border` | May be invisible on white | May be invisible on dark bg | High |

**Problem patterns:**
- `--border` and `--input` use same value - inputs may not stand out enough
- Dividers (1px borders) often become invisible when adjacent colors are similar
- Focus rings on dark backgrounds may not contrast enough

### 3. Background Contrast

| Component Area | Token Used | Light Mode | Dark Mode | Risk |
|----------------|------------|------------|-----------|------|
| Page background | `--background` | White | `222.2 84% 4.9%` (near black) | Low |
| Card | `--card` | White | Same as background | **High** |
| Secondary | `--secondary` | `210 40% 90%` (light gray) | `217.2 32.6% 17.5%` (dark slate) | Medium |
| Accent | `--accent` | Same as secondary | Same as secondary | Medium |
| Muted | `--muted` | `210 40% 96.1%` (very light) | `217.2 32.6% 17.5%` (dark) | Low |
| Primary button | `--primary` | `220 100% 30%` (dark blue) | `217.2 91.2% 59.8%` (bright blue) | Low |

**Critical Issue:** Card background equals page background in dark mode (`222.2 84% 4.9%`). Without border or shadow, card content has zero separation.

### 4. Icon Contrast

| Icon Usage | Token/Class | Risk |
|-----------|-------------|------|
| Lucide icons with default color | Inherits text color | Low |
| Icons in ghost buttons | `hover:text-accent-foreground` | Low |
| Muted icons | `text-muted-foreground` | **High** |
| Status icons (success/warning/error) | Uses `--success`, `--warning`, `--destructive` | Low |

## Component-Specific Audit Checklist

### Shared UI Components (`src/components/ui/`)

| Component | Contrast Vulnerability Points | Priority |
|-----------|-------------------------------|----------|
| **button.tsx** | Ghost variant hover: `hover:!bg-accent hover:text-accent-foreground` - accent bg may blend | Medium |
| **input.tsx** | Placeholder text, focus ring visibility, border contrast | **High** |
| **dialog.tsx** | Overlay opacity (`bg-black/50`), content border | Medium |
| **toast.tsx** | Info toast uses card styling - may blend with background | **High** |
| **tag.tsx** | Semi-transparent bg (`bg-info/20`), opacity layers | Medium |
| **select.tsx** | Dropdown background contrast, selected item highlight | Medium |
| **checkbox.tsx** | Check mark visibility, focus ring | Medium |
| **virtual-table.tsx** | Row hover (`hover:bg-accent`), cell borders | Medium |
| **virtual-list.tsx** | Row hover states | Low |

### Feature Views (`src/features/*/components/`)

| Feature View | Notable Components | Contrast Risk |
|--------------|---------------------|---------------|
| **JenkinsView** | Build status badges, timestamps, job list rows | Medium |
| **LinksView** | Tag chips, URL text, folder tree icons | Medium |
| **BlackboardView** | Sticky notes (--sticky-* colors), text on colored bg | **High** |
| **RecordingsView** | Recording list items, playback controls | Medium |
| **AIAssistantView** | Chat messages, code blocks, streaming text | Medium |
| **HotNewsView** | Article cards, timestamps, source icons | Low |
| **ToolboxView** | JSON viewer, diff highlighting | Medium |

## Systematic Audit Approach

### Phase 1: Visual Audit (Manual)
1. Switch between light/dark/system themes
2. For each theme, screenshot all major views:
   - Side panel (all tabs)
   - Options page
   - Dialogs and toasts
3. Identify areas where:
   - Text blends into background
   - Borders are invisible
   - Interactive elements lack focus indication

### Phase 2: Token Audit (Automated + Manual)
Verify contrast ratios for CSS variable pairs:

| Check | Tool/Method |
|-------|-------------|
| Background + Text | Browser DevTools color picker, calculate ratio |
| Border + Adjacent | Visual inspection |
| Focus ring visibility | Browser accessibility inspector |

**Target ratios:**
- `--background` vs `--foreground`: Should be >7:1 (near white/black)
- `--card` vs `--card-foreground`: Should be >4.5:1
- `--muted` vs `--muted-foreground`: **Likely fails in dark mode** - needs verification
- `--border` vs `--background`: Should have >3:1 visual distinction

### Phase 3: Component-Level Fixes

Priority order based on user impact:

1. **Critical (fails WCAG AA):**
   - Fix `--muted-foreground` dark mode value (current: `215 20.2% 65.1%`)
   - Ensure placeholder text is visible
   - Card background vs foreground in dark mode

2. **High (visible but may pass):**
   - Tag component on colored backgrounds
   - Toast info variant styling
   - Input focus ring visibility

3. **Medium (polishing):**
   - Ghost button hover states
   - Dividers and separators
   - Virtual list/table row hover

4. **Low (enhancement):**
   - Icon-only button focus indicators
   - Disabled state styling

## Specific Tokens Requiring Review

Based on `uno.config.ts` analysis:

```
Light Mode Concerns:
- --muted-foreground: 215.4 16.3% 46.9% - gray-500, passes on white
- --border: 214.3 31.8% 91.4% - very light, may be invisible

Dark Mode Concerns:
- --muted-foreground: 215 20.2% 65.1% - gray-400
  - On --background (222.2 84% 4.9%): ~7.5:1 PASS
  - On --muted (217.2 32.6% 17.5%): ~2.5:1 FAIL
- --card: 222.2 84% 4.9% = --background, no distinction
- --secondary: 217.2 32.6% 17.5% = --muted, same issue
```

## Dependencies Between Components

```
Token Definition (uno.config.ts)
    └── All components reference tokens
           ├── Base components (button, input, dialog)
           │     └── Feature views use base components
           └── Custom styling (tag, toast)
                 └── Feature views use custom components
```

**Fix order:** Token values first, then component-specific overrides.

## Recommendations for Contrast Improvements

1. **Add visual separation to cards:** Either distinguish `--card` from `--background` in dark mode, or ensure all cards have visible borders.

2. **Review muted-foreground usage:** The `--muted-foreground` value passes on `--background` but fails on `--muted`. Audit all uses of muted text on muted backgrounds.

3. **Increase border visibility:** Consider darker border color in dark mode, or add subtle shadows.

4. **Test placeholder contrast:** The `placeholder:text-muted-foreground` pattern needs verification in both themes.

5. **Audit sticky note colors:** The `--sticky-*` colors must have sufficient contrast with their text colors, especially in dark mode.

## Sources

- UnoCSS theme configuration: `/Users/slothluo/code/github/DPP/uno.config.ts`
- shadcn/ui default theme: https://ui.shadcn.com/docs/theming
- WCAG 2.1 contrast requirements: https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html
- Browser extension contrast patterns: Industry best practices for dual-theme extensions
