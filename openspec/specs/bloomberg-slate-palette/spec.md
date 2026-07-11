# bloomberg-slate-palette Specification

## Purpose
TBD - created by archiving change frontend-dashboard-revamp. Update Purpose after archive.
## Requirements
### Requirement: Design token set uses Bloomberg Slate Amber palette
The `index.css` `:root` SHALL define a complete Bloomberg Slate Amber design token set replacing all current neon-cyan tokens. All components SHALL reference these CSS variables rather than hardcoded hex values.

Token definitions:
```css
--bg-root: #020617
--bg-card: #0F172A
--bg-elevated: #1E293B
--bg-chart: #0B1220
--border-card: rgba(255,255,255,0.07)
--border-panel: #1E293B
--text-primary: #F8FAFC
--text-secondary: #94A3B8
--text-dim: #64748B
--text-mono: #CBD5E1
--accent: #F59E0B
--accent-glow: rgba(245,158,11,0.15)
--signal-bull: #22C55E
--signal-bear: #EF4444
--signal-neutral: #F59E0B
--signal-quant: #60A5FA
--signal-pca: #A78BFA
--status-success: #22C55E
--status-danger: #EF4444
--status-warning: #F59E0B
```

#### Scenario: Amber accent replaces cyan throughout UI
- **WHEN** the application renders
- **THEN** all previously cyan-colored accents (active nav items, focus borders, accent text) are amber-gold

#### Scenario: Background uses deep navy not near-black obsidian
- **WHEN** the application renders
- **THEN** the root background is `#020617`, cards use `#0F172A`, elevated surfaces use `#1E293B`

### Requirement: chart-panel class replaces glass-card for chart containers
A new `.chart-panel` CSS class SHALL be defined that provides the glass background and border but WITHOUT the `transform: translateY(-2px)` hover effect, to prevent chart resize-loop jitter.

#### Scenario: Chart containers do not shift on hover
- **WHEN** user hovers over any chart-containing area
- **THEN** the container does not translate vertically or trigger a chart resize event

#### Scenario: Non-chart cards retain hover lift
- **WHEN** user hovers over BentoSummary cards or other non-chart UI cards
- **THEN** the subtle `translateY(-2px)` lift animation still applies

### Requirement: Typography uses Inter for headings, JetBrains Mono for data
All heading text (h1–h3, section titles) SHALL use `Inter` font. All numeric data values, axis labels, and monospaced terminal content SHALL use `JetBrains Mono`. Both fonts SHALL be loaded via Google Fonts `@import`.

#### Scenario: Headings render in Inter
- **WHEN** any page title or section heading is displayed
- **THEN** the font family is Inter, weight 600–700

#### Scenario: Data values render in JetBrains Mono
- **WHEN** numeric scores, dates, oscillator values, or code-like labels are displayed
- **THEN** the font family is JetBrains Mono, weight 400

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
