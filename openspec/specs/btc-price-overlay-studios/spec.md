# btc-price-overlay-studios Specification

## Purpose
TBD - created by archiving change frontend-dashboard-revamp. Update Purpose after archive.
## Requirements
### Requirement: Ichimoku Terminal renders 3-pane synchronized chart
The `IchimokuTerminal` component SHALL render three synchronized chart subplots inside a single zero-gap panel container:
1. **Pane 1 (BTC + Cloud overlay)**: Candlestick + Tenkan-sen + Kijun-sen + Span A + Span B + Chikou Span. Log scale by default.
2. **Pane 2 (IMO Oscillator)**: Bounded tanh `ichimoku_imo` as area series with `+0.50` and `-0.50` threshold price lines.
3. **Pane 3 (S-Components)**: S_TK (cyan), S_Cloud (amber), S_Future (violet), S_Chikou (green) as line series.

All three panes SHALL implement bidirectional crosshair synchronization and visible logical range synchronization.

#### Scenario: BTC + Ichimoku overlay renders in Pane 1
- **WHEN** user navigates to the Ichimoku Terminal tab
- **THEN** Pane 1 shows Bitcoin candlesticks with Tenkan, Kijun, Span A, Span B, and Chikou lines overlaid

#### Scenario: IMO oscillator renders in Pane 2
- **WHEN** Ichimoku Terminal loads
- **THEN** Pane 2 displays the `ichimoku_imo` area chart with `+0.50` bull and `-0.50` bear threshold dashed lines

#### Scenario: S-component lines render in Pane 3
- **WHEN** Ichimoku Terminal loads
- **THEN** Pane 3 displays S_TK, S_Cloud, S_Future, S_Chikou as colored line series using available data fields or computed fallbacks

#### Scenario: Crosshair sync across all 3 panes
- **WHEN** user moves the cursor over any pane
- **THEN** a vertical crosshair appears simultaneously on all three panes at the same date

### Requirement: ValuationStudio renders 2-pane synchronized chart
The `ValuationStudio` component SHALL render a BTC Candlestick pane (Pane 1) above the existing Valuation Composite area chart (Pane 2) with crosshair and range synchronization. Default scale on Pane 1 is logarithmic.

#### Scenario: BTC anchor pane visible in Valuation Studio
- **WHEN** user navigates to the Valuation Studio tab
- **THEN** a BTC candlestick pane appears above the Valuation Composite oscillator pane

#### Scenario: Crosshair syncs between BTC and Valuation panes
- **WHEN** user moves cursor over either pane
- **THEN** vertical crosshair appears on both panes at the same date

### Requirement: LttdLab renders 3-pane synchronized chart
The `LttdLab` component SHALL render: Pane 1 (BTC Candlestick, log scale), Pane 2 (HMM Probabilities: Bull/Bear/Sideways lines + 0.60 threshold), Pane 3 (20-day Realized Volatility area). All 3 panes SHALL be crosshair and range synced.

#### Scenario: BTC anchor pane visible in LTTD Lab
- **WHEN** user navigates to the LTTD Lab tab
- **THEN** a BTC candlestick pane appears above the HMM probability and volatility panes

#### Scenario: Crosshair syncs across all 3 LTTD panes
- **WHEN** user moves cursor over any pane
- **THEN** vertical crosshair appears on all three panes simultaneously

### Requirement: MttdConsole renders 3-pane synchronized chart
The `MttdConsole` component SHALL render: Pane 1 (BTC Candlestick, log scale), Pane 2 (MTTD IMO area + thresholds), Pane 3 (Kaufman ER + Shannon Entropy lines + gate threshold lines). All 3 panes SHALL be crosshair and range synced.

#### Scenario: BTC anchor pane visible in MTTD Console
- **WHEN** user navigates to the MTTD Console tab
- **THEN** a BTC candlestick pane appears above the IMO and Gates panes

#### Scenario: Gate visualizer shows traffic-light status badges
- **WHEN** the MTTD Console renders
- **THEN** three gate status badges are displayed: `ER Gate [●PASS|●FAIL]`, `Entropy Gate [●PASS|●FAIL]`, `Chikou Exit [●ACTIVE|●CLEAR]` with color-coded states

