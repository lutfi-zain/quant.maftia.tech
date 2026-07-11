# ichimoku-chart-rebuild Specification

## Purpose
TBD - created by archiving change frontend-dashboard-revamp. Update Purpose after archive.
## Requirements
### Requirement: Ichimoku Terminal reconstructs Tenkan/Kijun from OHLCV client-side
Because `unified_daily_analytics` does not return raw Tenkan-sen and Kijun-sen values, the `IchimokuTerminal` component SHALL compute these client-side from the `master_ohlcv` `high`/`low` arrays in `dailyData` using standard Ichimoku periods: Tenkan=9, Kijun=26, Senkou B=52, Chikou displacement=26.

Formulas:
- `Tenkan(t) = (max(High, 9) + min(Low, 9)) / 2`
- `Kijun(t) = (max(High, 26) + min(Low, 26)) / 2`
- `Span A(t) = (Tenkan(t) + Kijun(t)) / 2`  (plotted as-is, no forward displacement for simplicity)
- `Span B(t) = (max(High, 52) + min(Low, 52)) / 2`
- `Chikou(t) = Close(t - 26)` plotted at date `t`

All computations SHALL be strictly causal (no lookahead) using only `i-1` indices.

#### Scenario: Tenkan/Kijun lines render on BTC pane
- **WHEN** IchimokuTerminal loads with sufficient data (≥ 52 bars)
- **THEN** Tenkan (red, `#F87171`) and Kijun (blue, `#60A5FA`) lines appear overlaid on BTC candlesticks

#### Scenario: Span A and Span B rendered as cloud fill area
- **WHEN** IchimokuTerminal loads
- **THEN** Span A (green, 25% opacity) and Span B (red, 25% opacity) lines are drawn creating a visible cloud structure

#### Scenario: Chikou Span rendered with 26-bar lag
- **WHEN** IchimokuTerminal loads
- **THEN** the Chikou Span (purple, 50% opacity) represents Close price displaced backward by 26 bars

#### Scenario: Graceful handling of insufficient data
- **WHEN** fewer than 52 daily bars are loaded (e.g., on fresh install with minimal data)
- **THEN** Tenkan/Kijun lines start from bar index 9/26/52 respectively; earlier dates show only candlesticks

