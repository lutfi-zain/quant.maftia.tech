## ADDED Requirements

### Requirement: LttdLab shall display On-Chain Metrics panel

The LTTD Studio SHALL render an On-Chain Metrics panel below the backtest controls showing real-time on-chain indicator values with synchronized line charts and threshold override lines.

#### Scenario: Panel displays on-chain indicators

- **WHEN** the LttdLab component mounts and `dailyData` is available
- **THEN** the panel fetches on-chain data via `quantClient.getComponents('quant-btc-lttd-system')` filtered for on-chain metric names AND displays:
  - STH-MVRV line chart with a threshold line at 2.0 (red dashed, labeled "OVERRIDE >2.0")
  - STH-NUPL line chart with a threshold line at 0.75 (red dashed, labeled "OVERRIDE >0.75")
  - Current value indicator below each chart showing latest reading and alert status

#### Scenario: Charts use Lightweight Charts with standard setup

- **WHEN** the on-chain panel renders
- **THEN** each chart MUST lock the right price scale width to 85px and SHALL use `LineSeries` with theme-aware colors
- **THEN** charts SHALL NOT share crosshair sync with the main multi-pane chart

#### Scenario: Mobile responsive layout

- **WHEN** viewport width <= 768px
- **THEN** the on-chain panel stacks the two charts vertically with full width

#### Scenario: Hover crosshair shows tooltip

- **WHEN** user hovers over an on-chain chart
- **THEN** a tooltip appears showing the date and value at that point, with alert status color-coded (red when threshold exceeded)

### Requirement: On-chain data fetches from LTTD-specific components

The on-chain panel SHALL fetch data from the `/api/v1/quant/components` endpoint filtered by `system=quant-btc-lttd-system` and component names matching on-chain metric keys.

#### Scenario: Fetches component signals

- **WHEN** the on-chain panel initializes
- **THEN** it calls `quantClient.getComponents('quant-btc-lttd-system')` and filters entries where `component_name` is one of `STH-MVRV`, `STH-NUPL`, `STH-SOPR`
- **THEN** raw numeric values are used for charting (not normalized scores)
