## MODIFIED Requirements

### Requirement: Bloomberg Slate Palette Token Structure

The Bloomberg Slate Amber palette SHALL remain unchanged in its color hex values. The `:root` CSS custom properties SHALL be extended with the following spatial density tokens:

- `--radius-none: 0px`
- `--radius-sm: 2px`
- `--radius-md: 4px`
- `--space-xs: 4px`
- `--space-sm: 8px`
- `--space-md: 12px`
- `--space-lg: 16px`
- `--space-xl: 24px`

The legacy `--surface-glass` variable SHALL be redefined from `rgba(15, 23, 42, 0.8)` to the solid value `#0f172a` (equivalent to `var(--bg-card)`).

#### Scenario: Root tokens include spatial density scale
- **WHEN** the `:root` CSS variables are parsed
- **THEN** `--radius-md` SHALL resolve to `4px`
- **THEN** `--space-md` SHALL resolve to `12px`
- **THEN** `--surface-glass` SHALL resolve to `#0f172a`

#### Scenario: Color values remain unchanged
- **WHEN** the `:root` CSS variables are parsed
- **THEN** `--bg-root` SHALL remain `#020617`
- **THEN** `--accent` SHALL remain `#f59e0b`
- **THEN** `--signal-bull` SHALL remain `#22c55e`
