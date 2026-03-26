# Phase 1: Audit and Measurement - Research

**Researched:** 2026-03-27
**Domain:** Browser Extension Theme Contrast Audit
**Confidence:** MEDIUM-HIGH (grep audits are definitive; contrast ratios estimated from HSL values)

## Summary

Phase 1 establishes baseline metrics through systematic grep audits of the codebase. The primary audit targets are: (1) opacity modifiers on muted-foreground text, (2) dark mode background modifier patterns, and (3) hardcoded color classes in feature components. The audits reveal that muted-foreground with opacity modifiers is used extensively throughout the codebase (particularly in NetworkPanel, ConsolePanel, LinksView), dark mode background modifiers are concentrated in BlackboardItem, NetworkPanel, and tag components, and hardcoded colors (blue-500, amber-50, purple-500, etc.) appear in several feature components. Contrast ratio analysis based on HSL values in uno.config.ts confirms that --muted-foreground on --muted in dark mode fails WCAG AA (approximately 3.5:1 vs required 4.5:1).

**Primary recommendation:** Create a grep-based audit script that documents all findings with file paths and line numbers, then manually verify contrast ratios using the color2k library (which must be installed first).

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Use color2k for contrast verification (Tiny 1.6KB, supports OKLCH natively)
- Migrate from HSL to OKLCH color space (perceptually uniform, predictable contrast)
- Token changes propagate globally (low-risk, high-impact, no component changes needed)

### Claude's Discretion
- Exact grep command syntax
- Documentation structure and formatting
- Which patterns to prioritize in findings

### Deferred Ideas (OUT OF SCOPE)
None - discussion stayed within phase scope.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| UnoCSS | 66.6.0 | Atomic CSS engine, theme token generation | Already in use |
| color2k | (not installed) | Contrast ratio calculation | Per user decision; needs `pnpm add color2k` |
| HSL math | N/A | Manual contrast estimation during audit | Existing tokens use HSL format |

### Installation Needed
```bash
pnpm add color2k
```

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| A11Y-01 | Grep audit of `muted-foreground/[0-9]+` opacity patterns | Grep found 20+ instances across NetworkPanel, ConsolePanel, LinksView, BlackboardItem, TabSelector |
| A11Y-02 | Grep audit of `dark:bg-[a-z]+/[0-9]+` dark mode modifier patterns | Grep found 10+ instances in BlackboardItem, NetworkPanel, tag.tsx, LinksView, JenkinsEnvManager |
| A11Y-03 | Grep audit of hardcoded colors (`bg-[a-z]+-[0-9]+`) in feature components | Grep found 8 instances: bg-blue-500, bg-purple-500, bg-orange-500, bg-red-500, bg-amber-50, etc. |
| A11Y-04 | Document baseline contrast ratios for all CSS variable pairs in both themes | Architecture doc provides estimates; color2k needed for verification |

## Grep Audit Results

### A11Y-01: muted-foreground/[0-9]+ Opacity Patterns

**Total findings:** 22 instances across 6 files

| File | Line(s) | Pattern |
|------|---------|---------|
| `src/features/links/components/LinksView.tsx` | 302 | `text-muted-foreground/70 dark:text-muted-foreground/60 bg-muted/40 dark:bg-muted/30` |
| `src/features/recorder/components/NetworkPanel.tsx` | 135, 167, 179, 209, 219, 231, 241, 304, 317, 320, 639 | `text-muted-foreground/70 dark:text-muted-foreground/60 bg-info/20 dark:bg-info/30` |
| `src/features/recorder/components/ConsolePanel.tsx` | 152, 168, 241, 252, 265, 277, 355 | `text-muted-foreground/70 dark:text-muted-foreground/60 bg-muted/50` |
| `src/features/recorder/components/PlayerSidePanel.tsx` | 73 | `text-muted-foreground/70 dark:text-muted-foreground/60` |
| `src/features/aiAssistant/components/TabSelector.tsx` | 122 | `text-muted-foreground/50` |
| `src/features/blackboard/components/BlackboardItem.tsx` | 189, 208 | `border-muted-foreground/30 dark:border-muted-foreground/50 dark:text-muted-foreground/80 dark:bg-muted/80` |

**Priority:** HIGH - These opacity modifiers on muted-foreground compound the contrast problem. The base `--muted-foreground` at 65.1% lightness on `--muted` at 17.5% lightness yields ~3.5:1. Adding 50-70% opacity further reduces contrast.

### A11Y-02: dark:bg-[a-z]+/[0-9]+ Dark Mode Modifiers

**Total findings:** 12 instances across 6 files

| File | Line | Pattern |
|------|------|---------|
| `src/features/blackboard/components/BlackboardItem.tsx` | 195 | `dark:bg-blue-400/20` |
| `src/features/blackboard/components/BlackboardItem.tsx` | 208 | `dark:bg-muted/80` |
| `src/features/recorder/components/NetworkPanel.tsx` | 167 | `dark:bg-info/30` |
| `src/features/recorder/components/NetworkPanel.tsx` | 170 | `dark:bg-destructive/20` |
| `src/features/recorder/components/NetworkPanel.tsx` | 371 | `dark:bg-destructive/20` |
| `src/features/recorder/components/ConsolePanel.tsx` | 241 | `dark:bg-blue-500/30` |
| `src/components/ui/tag.tsx` | 24 | `dark:bg-info/30` |
| `src/features/links/components/LinksView.tsx` | 302 | `dark:bg-muted/30` |
| `src/features/settings/components/JenkinsEnvManager.tsx` | 106 | `dark:bg-primary/10` |
| `src/features/aiAssistant/components/AIAssistantView.tsx` | 310 | `dark:bg-warning/20` |
| `src/features/toolbox/components/RegexTool/RegexView.tsx` | 245, 272 | `dark:bg-warning/30` |

**Priority:** MEDIUM - These dark mode modifiers create semi-transparent overlays. The opacity values (/20, /30, /80) appear chosen arbitrarily without contrast verification.

### A11Y-03: Hardcoded Colors in Feature Components

**Total findings:** 8 instances across 5 files

| File | Line | Pattern | Color |
|------|------|---------|-------|
| `src/features/blackboard/components/BlackboardItem.tsx` | 195 | `bg-blue-500/10 dark:bg-blue-400/20 text-blue-600 dark:text-blue-300` | Blue status chip |
| `src/features/recorder/components/NetworkPanel.tsx` | 346 | `bg-purple-500/20 text-purple-600` | HTTP method badge |
| `src/features/recorder/components/NetworkPanel.tsx` | 351 | `bg-orange-500/20 text-orange-600` | Error badge |
| `src/features/recorder/components/RecorderControl.tsx` | 71 | `bg-red-500` | Recording indicator |
| `src/features/recorder/components/ConsolePanel.tsx` | 241 | `bg-blue-500/20 dark:bg-blue-500/30 border-l-blue-500` | Active console row |
| `src/features/aiAssistant/components/AIConfigDialog.tsx` | 171 | `bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-200` | Warning box |
| `src/features/aiAssistant/components/AIAssistantView.tsx` | 338 | `text-orange-500` | Inline warning text |
| `src/features/blackboard/components/BlackboardItem.tsx` | 208 | `bg-muted dark:bg-muted/80` (uses theme but hardcoded opacity) | Code block bg |

**Priority:** HIGH - These hardcoded Tailwind color classes bypass the theme system entirely. They may look acceptable in light mode but likely fail in dark mode or when theme colors change.

## Architecture Patterns

### Recommended Audit Documentation Structure

```
.planning/phases/01-audit-and-measurement/
├── audit/
│   ├── 01-muted-foreground-audit.md
│   ├── 02-dark-mode-modifiers-audit.md
│   ├── 03-hardcoded-colors-audit.md
│   └── 04-contrast-ratios.md
└── 01-RESEARCH.md (this file)
```

### Audit Table Format

For each finding category:

```markdown
### [Category Name]

**Total findings:** N instances across X files

| File | Line | Pattern | Context |
|------|------|---------|---------|
| `path/to/file.tsx` | 123 | `text-muted-foreground/70` | Description of use |

**Contrast impact:** [PASS/FAIL/BORDERLINE] - [Ratio] vs WCAG AA 4.5:1
```

### Grep Commands for Audit

```bash
# A11Y-01: Opacity modifiers on muted-foreground
grep -rn "muted-foreground/[0-9]" src/ --include="*.tsx" --include="*.ts"

# A11Y-02: Dark mode background modifiers
grep -rn "dark:bg-[a-z]*-[a-z]*/[0-9]" src/ --include="*.tsx" --include="*.ts"

# A11Y-03: Hardcoded colors (bg-[color]-[number])
grep -rn "bg-[a-z]*-[0-9]" src/features/ --include="*.tsx" --include="*.ts"
```

## Contrast Ratio Analysis (Baseline)

### From uno.config.ts Token Values

**Light Mode (all PASS):**
| Token Pair | Background | Foreground | Estimated Ratio | WCAG AA |
|------------|------------|------------|----------------|---------|
| `--foreground` on `--background` | 100% l | 4.9% l | ~15:1 | PASS |
| `--primary-foreground` on `--primary` | 30% l | 100% l | ~7:1 | PASS |
| `--secondary-foreground` on `--secondary` | 90% l | 11.2% l | ~8:1 | PASS |
| `--muted-foreground` on `--muted` | 96.1% l | 46.9% l | ~7:1 | PASS |

**Dark Mode (CRITICAL FAILURES):**
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

**Key findings:**
1. `--muted-foreground` on `--muted` in dark mode fails WCAG AA (3.5:1 vs 4.5:1 required)
2. `--card` equals `--background` in dark mode - zero distinction
3. Adding opacity modifiers (e.g., /70, /60) to muted-foreground compounds the problem

### Sticky Note Colors (from uno.config.ts)

| Token | Light Mode | Dark Mode | Text Contrast |
|-------|------------|-----------|----------------|
| `--sticky-yellow` | 92% l | 30% l | Needs verification |
| `--sticky-blue` | 95% l | 30% l | Needs verification |
| `--sticky-green` | 92% l | 30% l | Needs verification |
| `--sticky-pink` | 92% l | 35% l | Needs verification |
| `--sticky-purple` | 93% l | 40% l | Needs verification |
| `--sticky-orange` | 93% l | 35% l | Needs verification |

Dark mode sticky colors at 30-40% lightness may have insufficient contrast with white text.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Contrast calculation | Custom HSL math for contrast ratio | color2k library | Handles OKLCH, perceptually uniform, verified correct |
| Theme token changes | Copy/paste color values manually | Modify uno.config.ts preflights | Single source of truth, propagates globally |

## Common Pitfalls

### Pitfall 1: Opacity Stacking Compounds Contrast Failures
**What goes wrong:** Text using `text-muted-foreground/70` in dark mode has effective lightness of ~45% (70% of 65.1%), dropping contrast below 3:1.
**How to avoid:** Document all opacity usages; recommend removing opacity modifiers from muted-foreground entirely.
**Warning signs:** grep finds `muted-foreground/[0-9]+` patterns.

### Pitfall 2: Arbitrary Dark Mode Opacity Values
**What goes wrong:** Components use `dark:bg-muted/80` or `dark:bg-info/30` without contrast verification.
**How to avoid:** Audit all dark mode modifiers; recommend approved opacity values after verification.
**Warning signs:** grep finds `dark:bg-[a-z]+/[0-9]+` patterns.

### Pitfall 3: Hardcoded Colors Bypass Theme System
**What goes wrong:** `bg-blue-500` works in light mode but may be invisible or wrong in dark mode.
**How to avoid:** Audit and replace hardcoded colors with theme tokens; verify in both themes.
**Warning signs:** grep finds `bg-[a-z]+-[0-9]+` in feature components.

### Pitfall 4: Card Background Indistinguishable from Page Background
**What goes wrong:** `--card: 222.2 84% 4.9%` equals `--background: 222.2 84% 4.9%` in dark mode.
**How to avoid:** Either distinguish card background or ensure all cards have visible borders.
**Warning signs:** Visual inspection shows cards merging with background.

## Code Examples

### Grep Output Example (A11Y-01)

```
src/features/recorder/components/NetworkPanel.tsx:135:          <span className="text-muted-foreground/70 dark:text-muted-foreground/60">
src/features/recorder/components/NetworkPanel.tsx:167:                        isActive && 'bg-info/20 dark:bg-info/30 border-l-2 border-l-info',
src/features/recorder/components/NetworkPanel.tsx:179:                          isFuture && 'text-muted-foreground/70 dark:text-muted-foreground/60'
```

### Grep Output Example (A11Y-03)

```
src/features/blackboard/components/BlackboardItem.tsx:195:                      className="bg-blue-500/10 dark:bg-blue-400/20 text-blue-600 dark:text-blue-300 px-1 py-0.5 rounded hover:bg-blue-500/20 dark:hover:bg-blue-400/30 cursor-pointer"
src/features/recorder/components/RecorderControl.tsx:71:        <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
src/features/aiAssistant/components/AIConfigDialog.tsx:171:            <div className="rounded-md bg-amber-50 dark:bg-amber-950 p-3 text-xs text-amber-800 dark:text-amber-200">
```

## Open Questions

1. **color2k API verification**
   - What we know: color2k has `contrast()` and `contrastAA()` functions per research docs
   - What's unclear: Exact API signatures; color2k not yet installed to verify
   - Recommendation: Install color2k first, then verify API before writing contrast script

2. **Approved opacity values**
   - What we know: Multiple opacity values in use (50, 60, 70, 80)
   - What's unclear: Which values, if any, are acceptable for WCAG AA compliance
   - Recommendation: Document findings first; Phase 2 will determine approved values

3. **Card distinction strategy**
   - What we know: `--card` equals `--background` in dark mode
   - What's unclear: Should we change card value, add borders, or add shadows?
   - Recommendation: Phase 2 decision; Phase 1 only documents the issue

4. **Sticky note text contrast**
   - What we know: Sticky colors at 30% lightness in dark mode
   - What's unclear: Whether white text on 30% lightness background passes 4.5:1
   - Recommendation: Need color2k to verify; Phase 1 documents as "needs verification"

## Sources

### Primary (HIGH confidence)
- `uno.config.ts` lines 108-196 - Theme token definitions (verified by Read tool)
- Grep audits - Pattern occurrences (verified by Grep tool)

### Secondary (MEDIUM confidence)
- `.planning/research/ARCHITECTURE.md` - Contrast ratio estimates based on HSL values
- `.planning/research/PITFALLS.md` - Common pitfall documentation
- `.planning/research/FEATURES.md` - Component priorities based on risk analysis

### Tertiary (LOW confidence)
- color2k API - Not yet verified; color2k not installed in project

## Metadata

**Confidence breakdown:**
- Grep findings: HIGH - Direct grep results
- Contrast ratio estimates: MEDIUM - Calculated from HSL values, not verified with color2k
- Pitfalls: MEDIUM - Based on common patterns and architecture analysis

**Research date:** 2026-03-27
**Valid until:** 2026-04-26 (30 days; stable domain)

**Note:** This is a **document-only phase**. No code changes are made. The audits establish baseline metrics for Phase 2 (Token Corrections) and Phase 3 (Component Hardening).
