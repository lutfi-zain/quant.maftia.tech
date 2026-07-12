# ichimoku-reference-equity Specification

## ADDED Requirements

### Requirement: Pure Ichimoku Reference Position Stored in Database

The `run_report_pipeline.py` SHALL extract the pure (non-overridden) Ichimoku position from the prior system's `Pos` column in the `df_ich` DataFrame BEFORE applying LTTD Sideways or Valuation Bubble macro overrides. This pure position SHALL be stored as `ichi_ref_pos` in `unified_daily_analytics`.

The pure position SHALL be the output of the Ichimoku system's `generate_signals()` function — the same value that feeds into the prior standalone system's `run_backtest()`.

#### Scenario: Reference position matches prior system's Pos

- **WHEN** pipeline execution completes
- **THEN** `unified_daily_analytics.ichi_ref_pos` SHALL contain the same values as the prior system's `Pos` column for every date where `Pos` is not NULL
- **AND** `ichi_ref_pos` SHALL differ from `ichimoku_position` on any date where macro overrides forced `ichimoku_position = 0.0`

### Requirement: Cumulative Reference Equity Curves Stored in Database

The pipeline SHALL call `run_backtest(df_ich, transaction_cost=0.001)` from the prior system's `backtest.py` module after `generate_signals()` completes. The resulting `Cum_Strat` and `Cum_Market` columns SHALL be stored as `ichi_cum_strat` and `ichi_cum_market` in `unified_daily_analytics`.

Both curves SHALL be stored as equity multipliers (1.0 = initial capital; 2.0 = 100% return; 0.5 = 50% loss), matching the prior system's `(1 + ret).cumprod()` output format.

#### Scenario: Cumulative strat matches prior system's backtest

- **WHEN** pipeline execution completes
- **THEN** `unified_daily_analytics.ichi_cum_strat` on the final date SHALL match the prior system's `Cum_Strat.iloc[-1]` within tolerance $|a - b| < 10^{-6}$

#### Scenario: Cumulative market matches buy-and-hold

- **WHEN** pipeline execution completes
- **THEN** `unified_daily_analytics.ichi_cum_market` on any date SHALL equal `(close_that_date / close_first_date)` within tolerance $|a - b| < 10^{-6}$

### Requirement: API Returns Reference Equity Fields

The `GET /api/v1/quant/daily` endpoint SHALL include `ref_pos`, `cum_strat`, and `cum_market` fields under the `ichimoku_imo` response sub-object.

All three fields SHALL be `null` in the JSON response when the database returns NULL for those columns (e.g., on dates before the prior system's warmup period).

#### Scenario: API returns reference equity for populated dates

- **WHEN** `GET /api/v1/quant/daily?limit=10` is queried
- **THEN** each item in the response `data` array SHALL have `ichimoku_imo.ref_pos`, `ichimoku_imo.cum_strat`, and `ichimoku_imo.cum_market` fields
- **AND** for dates where DB values are non-NULL, the API values SHALL match within tolerance $|a - b| < 10^{-6}$

### Requirement: FE Terminal Renders Reference Equity from API

The `IchimokuTerminal.tsx` equity curve subplot (Pane 4) SHALL default to rendering two line series sourced from API-provided fields:

- Strategy curve: `ichimoku_cum_strat` from `DailyAnalyticsPoint`, drawn in green (`#22C55E`)
- Market curve: `ichimoku_cum_market` from `DailyAnalyticsPoint`, drawn in blue (`#3B82F6`)

The interactive `useStudioBacktest` recomputation SHALL be preserved as an optional toggle overlay, NOT as the default equity curve data source.

#### Scenario: Pane 4 shows API-sourced equity on initial load

- **WHEN** IchimokuTerminal mounts with `dailyData` containing populated `ichimoku_cum_strat` and `ichimoku_cum_market`
- **THEN** the equity subplot SHALL display two line series with the title "Cum_Strat (Reference)" and "Cum_Market (BTC Reference)"
- **AND** the interactive backtest curve SHALL NOT be visible until the user toggles it

#### Scenario: Interactive backtest remains functional as overlay

- **WHEN** the user toggles interactive backtest visibility
- **THEN** the `useStudioBacktest` curve SHALL render as a third line series labeled "Interactive (What-If)"
- **AND** the original reference curves SHALL remain visible for comparison

### Requirement: Reference Equity in Component Signals

The pipeline SHALL write the following entries to `unified_component_signals` with `system_source = 'ICHIMOKU_REFERENCE'`:

- `component_name='REF_POS'` — pure position value
- `component_name='CUM_STRAT'` — cumulative strategy return (in percent, normalized)
- `component_name='CUM_MARKET'` — cumulative market return (in percent, normalized)

This allows the `/api/v1/quant/components?system=quant-lttd-ichimoku` endpoint to return reference equity data separately from the overridden position data.

#### Scenario: Component signals include ICHIMOKU_REFERENCE records

- **WHEN** pipeline execution completes
- **THEN** `unified_component_signals` SHALL have rows with `system_source='ICHIMOKU_REFERENCE'` for each date where reference position is non-NULL
