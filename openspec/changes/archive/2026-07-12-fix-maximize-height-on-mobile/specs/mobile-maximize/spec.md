## ADDED Requirements

### Requirement: Mobile maximized chart panel height SHALL account for bottom tab bar

When a chart panel is maximized on a mobile viewport (`isMobile === true`), the `getPanelHeights()` function SHALL subtract the bottom tab bar height (56px) from the available viewport height before computing chart dimensions. This ensures the Lightweight Charts internal canvas dimensions match the CSS-rendered container height (`calc(100dvh - 56px)`).

#### Scenario: Maximize BTC panel on mobile

- **WHEN** user taps maximize on the BTC chart panel on a mobile device
- **THEN** the BTC panel height SHALL be `window.visualViewport?.height || window.innerHeight - 56`
- **AND** the Lightweight Charts `.resize()` call SHALL use this corrected height
- **AND** no chart content SHALL be hidden behind the bottom tab bar

#### Scenario: Semi-maximize secondary panel on mobile

- **WHEN** user maximizes a secondary panel (e.g., HMM, IMO, Gates, Vol, SComp) on mobile
- **THEN** the BTC panel SHALL get 65% of `available = viewport - 56`
- **AND** the secondary panel SHALL get 35% of `available`

### Requirement: Desktop maximize behavior SHALL remain unchanged

The `getPanelHeights()` function SHALL NOT subtract the bottom tab bar height when `isMobile` is `false`. Desktop layout has no bottom tab bar.

#### Scenario: Maximize BTC panel on desktop

- **WHEN** user taps maximize on the BTC chart panel on a desktop device
- **THEN** the BTC panel height SHALL be `window.visualViewport?.height || window.innerHeight` (unchanged)
- **AND** the CSS-rendered container SHALL be `100dvh` (full viewport)

### Requirement: All 4 studio components SHALL use the consistent pattern

The fix SHALL be applied identically to ValuationStudio, LttdLab, MttdConsole, and IchimokuTerminal.

#### Scenario: Consistent constant definition

- **WHEN** each studio's `getPanelHeights()` is inspected
- **THEN** it SHALL define `MOBILE_BOTTOM_TAB_HEIGHT = 56` (or equivalent local constant)
- **AND** the subtraction logic SHALL be identical across all 4 files

#### Scenario: Default mobile heights unchanged

- **WHEN** no panel is maximized on mobile (`maximized === null`, `isMobile === true`)
- **THEN** the default heights (`{ btc: 160, ... }`) SHALL remain unchanged
- **AND** no viewport calculation SHALL be applied
