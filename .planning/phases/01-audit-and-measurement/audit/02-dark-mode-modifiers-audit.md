# A11Y-02: Dark Mode Modifier Patterns Audit

**Requirement:** Grep audit of `dark:bg-[a-z]+/[0-9]+` dark mode modifier patterns

## Summary

**Total findings:** 12 instances across 6 files

## Detailed Findings

| File | Line | Pattern | Context |
|------|------|---------|---------|
| `src/features/blackboard/components/BlackboardItem.tsx` | 195 | `dark:bg-blue-400/20` | Sticky note status indicator |
| `src/features/blackboard/components/BlackboardItem.tsx` | 208 | `dark:bg-muted/80` | Code block background |
| `src/features/recorder/components/NetworkPanel.tsx` | 167 | `dark:bg-info/30` | Active request row |
| `src/features/recorder/components/NetworkPanel.tsx` | 170 | `dark:bg-destructive/20` | Error response row |
| `src/features/recorder/components/NetworkPanel.tsx` | 371 | `dark:bg-destructive/20` | Error response badge |
| `src/features/recorder/components/ConsolePanel.tsx` | 241 | `dark:bg-blue-500/30` | Active console row |
| `src/components/ui/tag.tsx` | 24 | `dark:bg-info/30` | Tag component |
| `src/features/links/components/LinksView.tsx` | 302 | `dark:bg-muted/30` | Link metadata background |
| `src/features/settings/components/JenkinsEnvManager.tsx` | 106 | `dark:bg-primary/10` | Env var highlight |
| `src/features/aiAssistant/components/AIAssistantView.tsx` | 310 | `dark:bg-warning/20` | Warning message background |
| `src/features/toolbox/components/RegexTool/RegexView.tsx` | 245 | `dark:bg-warning/30` | Regex match highlight |
| `src/features/toolbox/components/RegexTool/RegexView.tsx` | 272 | `dark:bg-warning/30` | Regex match highlight |

## Contrast Impact

**WCAG AA Status:** BORDERLINE TO FAIL

Analysis:
- Opacity values (/10, /20, /30, /80) appear chosen arbitrarily
- Semi-transparent overlays compound with dark background
- Most critical: `dark:bg-primary/10` at 10% opacity provides minimal visual distinction

## Recommendations

1. Phase 2 will define approved opacity values after contrast verification
2. Avoid `dark:bg-primary/10` pattern - too subtle for dark mode
3. Prefer `dark:bg-muted/XX` with XX >= 50 for meaningful distinction
