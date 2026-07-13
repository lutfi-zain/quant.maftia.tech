# ichimoku-chart-rebuild Specification

## Purpose

Defines requirements for the 4-pane Ichimoku quantitative chart rebuild, including API-provided Ichimoku price-level lines at authoritative hyper-tuned periods (20, 60, 120), API-sourced causal S-components without synthetic fallbacks, accurate component metadata/signals, and reference vs strategy equity curve comparison with interactive What-If overlays.

## MODIFIED Requirements

### Requirement: S-Component chart pane uses API-provided values, not synthetic fallbacks

The IchimokuTerminal S-Component pane (Pane 3, bottom subplot in 4-pane layout) SHALL render S_TK, S_Cloud, S_Future, and S_Chikou causal reference lines using values from the `ichimoku_s_tk`, `ichimoku_s_cloud`, `ichimoku_s_future`, `ichimoku_s_chikou` fields in the daily API response. The existing synthetic fallback code (`p.ichimoku_imo * 0.8`, `Math.sin(i * 0.08) * 0.6`, etc.) SHALL be removed entirely. If an API value is NULL for a given date (warmup period), that individual date point SHALL be omitted rather than replaced with a synthetic value.

#### Scenario: S-component lines render with real API data
- **WHEN** IchimokuTerminal loads daily data containing `ichimoku_s_tk`, `ichimoku_s_cloud`, `ichimoku_s_future`, `ichimoku_s_chikou`
- **THEN** the four S-component series SHALL render exactly as received from the API, with the same styling (S_TK = cyan `#22D3EE`, S_Cloud = amber `#F59E0B`, S_Future = violet `#A78BFA`, S_Chikou = green `#22C55E`) and no synthetic data substitution

#### Scenario: Warmup period shows no S-component lines (NULL gaps)
- **WHEN** the API returns null for a subset of early dates (e.g., first 60 bars where kijun/chikou have no valid value)
- **THEN** the corresponding chart series SHALL show line segments only where API values are non-null, with gaps during warmup

#### Scenario: Leading and lagging momentum features visibly distinguished on S-Component chart pane
- **WHEN** the user inspects Pane 3 (S-Component momentum chart)
- **THEN** leading momentum (`S_Future`, forward projection of Senkou Span A-B spread) and lagging momentum (`S_Chikou`, 60-bar displacement confirmation) SHALL be explicitly plotted with accurate tooltip readouts and synchronized crosshair lines

### Requirement: Equity Curve Subplot Uses API Reference Data and 4-Pane Layout

The equity curve subplot (Pane 4 in the 4-pane layout) SHALL render two line series sourced from API-provided reference equity fields:

- `ichimoku_cum_strat` — green (`#22C55E`), labeled "Cum_Strat (Reference)"
- `ichimoku_cum_market` — blue (`#3B82F6`), labeled "Cum_Market (BTC Reference)"

The interactive `useStudioBacktest` curve SHALL be preserved as a toggleable overlay labeled "Interactive (What-If)", NOT as the default data source.

#### Scenario: Pane 4 shows reference equity by default
- **WHEN** IchimokuTerminal mounts with `dailyData` containing populated `ichimoku_cum_strat` and `ichimoku_cum_market`
- **THEN** the equity subplot SHALL display two line series with the reference labels
- **AND** the interactive backtest curve SHALL NOT be visible by default

#### Scenario: Interactive backtest renders on user toggle
- **WHEN** the user clicks a toggle button labeled "Show What-If"
- **THEN** the `useStudioBacktest` curve SHALL appear as a third line series with label "Interactive (What-If)"
- **AND** the reference curves SHALL remain visible

#### Scenario: Vertical crosshair synchronization and 85px Y-axis lock maintained across all 4 panes
- **WHEN** the user moves the cursor over any of the 4 panes (`btcChart`, `oscChart`, `sCompChart`, `eqChart`)
- **THEN** vertical crosshairs (`syncCrosshairs`) SHALL align perfectly across all panes without horizontal time-tick drift due to strict `rightPriceScale: { minimumWidth: 85 }` width locking
