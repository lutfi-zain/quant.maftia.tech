## ADDED Requirements

### Requirement: LttdLab 4-pane chart shall expand to 5 panes

The LTTD Studio's synchronized chart panel SHALL expand from 4 panes to 5 panes by adding dedicated subplots for Final Ensemble Score, Target Exposure, and Regime State between the existing BTC Candlestick and HMM Probability panes. Total becomes: BTC Candlestick + Final Score + Target Exposure + Regime State + Equity Curve.

**Current 4 panes:** BTC | HMM Probs | Volatility | Equity  
**New 5 panes:** BTC | Final Score | Target Exposure | Regime State | Equity

#### Scenario: Final Score pane

- **WHEN** the chart renders
- **THEN** a new Final Score subplot appears between BTC and HMM with:
  - Title "LTTD Score"
  - `LineSeries` or `AreaSeries` showing `lttd_score` from dailyData
  - Color using the existing `--signal-quant` CSS variable
  - No time axis visible (time shown on bottom pane only)
  - Maximize button

#### Scenario: Target Exposure pane

- **WHEN** the chart renders
- **THEN** a new Target Exposure subplot appears with:
  - Title "Target Exposure (Conviction)"
  - `HistogramSeries` showing `target_exposure` as a percentage (0% to 100%)
  - Color using `--signal-bull` green shades
  - No time axis visible
  - Maximize button

#### Scenario: Regime State pane

- **WHEN** the chart renders
- **THEN** a new Regime State subplot appears with:
  - Title "Regime State (-1 Bear, 0 Sideways, +1 Bull)"
  - `LineSeries` with `LineType.WithSteps` mapping regime to numeric: BULL → +1, BEAR → -1, SIDEWAYS → 0
  - Color using existing regime colors
  - No time axis visible
  - Reference lines at -1, 0, +1 positions
  - Maximize button

#### Scenario: Maximize mode includes new panes

- **WHEN** user maximizes any pane
- **THEN** the `getPanelHeights` function SHALL include all 5 panes in the layout calculation
- **WHEN** user maximizes BTC
- **THEN** all other panes collapse to 0 height
- **WHEN** user maximizes any non-BTC pane
- **THEN** BTC stays at 50% height, the selected pane occupies 50%

#### Scenario: Regime State replaces old regime determination

- **WHEN** `lttd_regime` from dailyData is a string like "BULL" / "BEAR" / "SIDEWAYS"
- **THEN** the step line maps it to +1.0 / -1.0 / 0.0 respectively
- **WHEN** `lttd_regime` is an object `{ regime }`
- **THEN** the value is extracted from `.regime` property

#### Scenario: Y-axis width lock preserved

- **WHEN** the chart initializes or resizes
- **THEN** all 5 panes SHALL have their right price scale width locked to 85px, enforced via `syncYAxisWidth` with double `requestAnimationFrame` in the effect and ResizeObserver
