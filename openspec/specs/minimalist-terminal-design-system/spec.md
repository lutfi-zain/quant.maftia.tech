# minimalist-terminal-design-system Specification

## Purpose
TBD - Created as part of ui-ux-pro-max change.

## Requirements

### Requirement: Border-Radius Scale

The terminal SHALL enforce a 3-tier border-radius scale across all UI elements:
- `0px` for chart containers and data tables
- `2px` for buttons, badges, toggle groups, and form inputs
- `4px` for cards (`.glass-card`), panels (`.chart-panel`), sidebar sections, and modal dialogs

No UI element SHALL use a border-radius exceeding `4px` in the desktop viewport.

#### Scenario: Card renders with sharp corners
- **WHEN** a `.glass-card` or `.chart-panel` element renders on desktop
- **THEN** its computed `border-radius` SHALL be `4px`

#### Scenario: Button renders with minimal radius
- **WHEN** a `.toggle-btn`, `.sync-btn`, or `.icon-btn` renders
- **THEN** its computed `border-radius` SHALL be `2px`

#### Scenario: Badge renders with sharp corners
- **WHEN** a `.gate-badge` or `.sync-badge` renders
- **THEN** its computed `border-radius` SHALL be `4px`

### Requirement: Compact Spacing Scale

The terminal SHALL use a compact 8px-grid spacing system:
- Card internal padding: `12px`
- Grid gap between cards: `10px`
- Header section bottom padding: `8px`
- Navigation item vertical padding: `7px`
- Navigation item gap: `2px`
- Chart subplot header padding: `6px 10px`

#### Scenario: Bento grid renders with tight gaps
- **WHEN** the `BentoSummary` grid renders on desktop
- **THEN** the `gap` between grid children SHALL be `10px`

#### Scenario: Main content area uses compact padding
- **WHEN** the `<main>` layout renders on desktop
- **THEN** padding SHALL be `16px 24px`

### Requirement: Solid Opaque Surfaces

The terminal SHALL NOT use `backdrop-filter: blur()` or semi-transparent `rgba()` backgrounds on card or panel surfaces. All surface backgrounds SHALL use solid opaque CSS variable values (`var(--bg-card)`, `var(--bg-elevated)`).

#### Scenario: Glass card renders without blur
- **WHEN** a `.glass-card` element renders
- **THEN** its `backdrop-filter` property SHALL be `none` and its `background` SHALL be the solid value of `var(--bg-card)`

#### Scenario: Chart panel renders without blur
- **WHEN** a `.chart-panel` element renders
- **THEN** its `backdrop-filter` property SHALL be `none` and its `background` SHALL be a solid value of `var(--bg-card)`

### Requirement: No Hover Lift Transforms

No card or panel element SHALL use `transform: translateY()` on `:hover` state. Hover feedback SHALL be limited to border-color brightening (`rgba(255,255,255,0.12)` → `rgba(255,255,255,0.18)`) and optional `box-shadow` intensification.

#### Scenario: Card hover does not shift position
- **WHEN** a user hovers over a `.glass-card` element
- **THEN** the element's `transform` property SHALL remain `none`
- **THEN** the element's `border-color` SHALL brighten to `rgba(255,255,255,0.18)`

### Requirement: Animation Policy

The terminal SHALL NOT include decorative scale or pulse animations on data cards. Only functional animations SHALL be permitted:
- `spin`: Loading indicator rotation
- `fadeIn`: Mobile drawer/backdrop transition

The `pulseGlow` keyframe and `.animate-pulse-glow` class SHALL be removed.

#### Scenario: No pulse animation on any card
- **WHEN any card element renders in any state**
- **THEN** no CSS animation using `scale()` transforms SHALL be applied

### Requirement: Scrollbar Density

Custom scrollbar width SHALL be `4px` (reduced from `6px`). Scrollbar thumb color SHALL use `rgba(255,255,255,0.08)` for the track-transparent look.

#### Scenario: Scrollbar renders thin
- **WHEN** a scrollable container renders on a WebKit-based browser
- **THEN** `::-webkit-scrollbar` width SHALL be `4px`
