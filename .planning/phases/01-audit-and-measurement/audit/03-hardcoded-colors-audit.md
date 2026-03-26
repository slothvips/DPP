# A11Y-03: Hardcoded Colors Audit

**Requirement:** Grep audit of hardcoded colors (`bg-[a-z]+-[0-9]+`) in feature components

## Summary

**Total findings:** 8 instances across 5 files

## Detailed Findings

| File | Line | Pattern | Color | Context |
|------|------|---------|-------|---------|
| `src/features/blackboard/components/BlackboardItem.tsx` | 195 | `bg-blue-500/10 dark:bg-blue-400/20 text-blue-600 dark:text-blue-300` | Blue | Status chip |
| `src/features/recorder/components/NetworkPanel.tsx` | 346 | `bg-purple-500/20 text-purple-600` | Purple | HTTP method badge |
| `src/features/recorder/components/NetworkPanel.tsx` | 351 | `bg-orange-500/20 text-orange-600` | Orange | Error badge |
| `src/features/recorder/components/RecorderControl.tsx` | 71 | `bg-red-500` | Red | Recording indicator dot |
| `src/features/recorder/components/ConsolePanel.tsx` | 241 | `bg-blue-500/20 dark:bg-blue-500/30 border-l-blue-500` | Blue | Active console row |
| `src/features/aiAssistant/components/AIConfigDialog.tsx` | 171 | `bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-200` | Amber | Warning box |
| `src/features/aiAssistant/components/AIAssistantView.tsx` | 338 | `text-orange-500` | Orange | Inline warning text |
| `src/features/blackboard/components/BlackboardItem.tsx` | 208 | `bg-muted dark:bg-muted/80` | Muted | Code block (uses theme but hardcoded opacity) |

## Contrast Impact

**WCAG AA Status:** FAIL (most instances)

Analysis:
- Hardcoded Tailwind colors bypass the theme system entirely
- Colors like `bg-blue-500`, `bg-purple-500`, `bg-orange-500` may be invisible or wrong in dark mode
- `text-orange-500` on dark backgrounds likely fails contrast
- `bg-amber-50` in light mode works, but `dark:bg-amber-950` needs verification

## Priority Ranking

| Priority | File | Issue |
|----------|------|-------|
| HIGH | `RecorderControl.tsx:71` | `bg-red-500` recording dot - critical for user awareness |
| HIGH | `AIAssistantView.tsx:338` | `text-orange-500` inline warning - likely fails contrast |
| MEDIUM | `NetworkPanel.tsx:346,351` | HTTP method and error badges |
| MEDIUM | `AIConfigDialog.tsx:171` | Warning box styling |
| LOW | `BlackboardItem.tsx:195,208` | Status chip and code block |

## Recommendations

1. Phase 3 will replace hardcoded colors with theme tokens
2. For status colors, create theme tokens like `--status-success`, `--status-warning`, `--status-error`
3. For HTTP method badges, use semantic tokens like `--http-get`, `--http-post`, etc.
