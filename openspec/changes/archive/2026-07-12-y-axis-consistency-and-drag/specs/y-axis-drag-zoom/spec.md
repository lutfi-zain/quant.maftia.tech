## ADDED Requirements

### Requirement: Vertical touch and mouse drag SHALL be enabled on the Y-axis

The chart panel SHALL support vertical dragging on the Y-axis (price/oscillator scale) for panning. The vertical drag SHALL work on both touch devices (finger drag) and desktop (mouse drag), matching the X-axis horizontal drag behavior.

#### Scenario: Touch vertical drag scrolls the chart

- **WHEN** a user drags vertically on the chart area with touch input
- **THEN** the chart SHALL vertically pan/scroll the price scale
- **AND** the vertical scroll SHALL be smooth and responsive

#### Scenario: Mouse drag on Y-axis pans vertically

- **WHEN** a user presses the mouse button and drags vertically on the chart area
- **THEN** the chart SHALL vertically pan/scroll the price scale
- **AND** this SHALL NOT interfere with the existing horizontal drag

### Requirement: Price axis press-move zoom SHALL be enabled

Clicking and dragging directly on the Y-axis (price scale) labels SHALL trigger vertical zoom (scale in/out), matching the X-axis time scale press-drag zoom behavior.

#### Scenario: Press-drag on price scale zooms

- **WHEN** a user presses the mouse button on the price scale label area and drags up or down
- **THEN** the chart SHALL zoom in/out vertically
- **AND** the zoom SHALL be smooth and proportional to drag distance

### Requirement: vertTouchDrag SHALL be enabled in all 4 studio components

The `handleScroll.vertTouchDrag` option SHALL be set to `true` in `makeCommonOptions()` for all studio components.

#### Scenario: Consistent configuration

- **WHEN** each studio's chart is initialized
- **THEN** the `handleScroll` options SHALL have `vertTouchDrag: true`
- **AND** this SHALL apply to ValuationStudio, LttdLab, MttdConsole, and IchimokuTerminal
