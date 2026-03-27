# A11Y-09: Approved Text Hierarchy Opacity Values

**Purpose:** Document approved opacity values for text hierarchy to maintain WCAG AA compliance.

## Principle

After Phase 2 token fixes, the base `--muted-foreground` token provides sufficient contrast (4.5:1+) in dark mode WITHOUT opacity modifiers. Avoid using opacity modifiers below 100% on `--muted-foreground` in dark mode.

## Approved Hierarchy

| Level | Token | Light Mode | Dark Mode (Fixed) | Usage |
|-------|-------|------------|-------------------|-------|
| Primary | `--foreground` | 4.9% l | 98% l | Headlines, important text |
| Secondary | `--secondary-foreground` | 11.2% l | 98% l | Subheadings, labels |
| Muted | `--muted-foreground` | 46.9% l | 75% l | Metadata, captions |

## Discouraged Patterns

| Pattern | Reason | Alternative |
|---------|--------|------------|
| `text-muted-foreground/70` | Compounds contrast issue | Use base token only |
| `text-muted-foreground/50` | Drops below 3:1 in dark | Use base token only |
| `dark:text-muted-foreground/60` | ~40% effective lightness | Use base token only |

## Enforcement

- ESLint rule: Disallow opacity modifiers on `muted-foreground` in dark mode
- Phase 3: Replace remaining opacity modifiers with base tokens
