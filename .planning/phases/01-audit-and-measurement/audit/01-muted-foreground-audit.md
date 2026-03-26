# A11Y-01: Muted-Foreground Opacity Patterns Audit

**Requirement:** Grep audit of `muted-foreground/[0-9]+` opacity patterns across all components

## Summary

**Total findings:** 22 instances across 6 files

## Detailed Findings

| File | Line(s) | Pattern | Context |
|------|---------|---------|---------|
| `src/features/links/components/LinksView.tsx` | 302 | `text-muted-foreground/70 dark:text-muted-foreground/60 bg-muted/40 dark:bg-muted/30` | Link metadata display |
| `src/features/recorder/components/NetworkPanel.tsx` | 135, 167, 179, 209, 219, 231, 241, 304, 317, 320, 639 | `text-muted-foreground/70 dark:text-muted-foreground/60 bg-info/20 dark:bg-info/30` | Network request rows |
| `src/features/recorder/components/ConsolePanel.tsx` | 152, 168, 241, 252, 265, 277, 355 | `text-muted-foreground/70 dark:text-muted-foreground/60 bg-muted/50` | Console log entries |
| `src/features/recorder/components/PlayerSidePanel.tsx` | 73 | `text-muted-foreground/70 dark:text-muted-foreground/60` | Player controls |
| `src/features/aiAssistant/components/TabSelector.tsx` | 122 | `text-muted-foreground/50` | Tab labels |
| `src/features/blackboard/components/BlackboardItem.tsx` | 189, 208 | `border-muted-foreground/30 dark:border-muted-foreground/50 dark:text-muted-foreground/80 dark:bg-muted/80` | Sticky note styling |

## Contrast Impact

**WCAG AA Status:** FAIL

Analysis:
- Base `--muted-foreground` at 65.1% lightness on `--muted` at 17.5% lightness yields approximately 3.5:1
- Adding opacity modifiers (/50, /60, /70) compounds the problem
- With /60 opacity: effective lightness ~39% (60% of 65.1%), contrast drops below 3:1

## Recommendations

1. Remove opacity modifiers from `muted-foreground` in dark mode
2. Phase 2 will adjust `--muted-foreground` lightness value to achieve 4.5:1
3. Until then, avoid patterns like `text-muted-foreground/XX` where XX < 100
