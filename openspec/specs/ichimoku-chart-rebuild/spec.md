# ichimoku-chart-rebuild Specification

## Purpose

Defines requirements for the 3-pane Ichimoku quantitative chart rebuild, including API-provided Ichimoku price-level lines at authoritative hyper-tuned periods (20, 60, 120), API-sourced causal S-components without synthetic fallbacks, accurate component metadata/signals, and reference vs strategy equity curve comparison with interactive What-If overlays.

## Requirements

### Requirement: Ichimoku Terminal reads Tenkan/Kijun from API

The IchimokuTerminal SHALL read Tenkan-sen, Kijun-sen, Senkou Span A, Senkou Span B, and Chikou Span values from the API-provided `DailyAnalyticsPoint` fields (`ichimoku_tenkan`, `ichimoku_kijun`, `ichimoku_senkou_a`, `ichimoku_senkou_b`, `ichimoku_chikou`) instead of computing them client-side.

The Price Action subplot (Pane 1) SHALL also render the Traditional Chikou Span series (purple line, styled with `color: 'rgba(168, 85, 247, 0.5)'`), computed on the client side by lagging the close price forward by `params.p2` days (default 60) as defined in the prior system.

The chart SHALL filter out NULL values using `.filter(d => d.value != null)`. It SHALL also overlay Buy and Sell markers on the candlestick series whenever the active position transitions (0 to 1 for Buy, 1 to 0 for Sell).

#### Scenario: Ichimoku lines render on BTC pane from API data
- **WHEN** IchimokuTerminal loads with daily data that includes `ichimoku_tenkan`, `ichimoku_kijun`, `ichimoku_senkou_a`, `ichimoku_senkou_b` fields
- **THEN** Tenkan (red, `#F87171`) and Kijun (blue, `#60A5FA`) lines appear overlaid on BTC candlesticks using API-provided values, and Span A (`rgba(34,197,94,0.25)`) / Span B (`rgba(239,68,68,0.25)`) lines form a visible cloud structure
- **AND** the traditional Chikou Span is rendered on Pane 1 using close price shifted forward by `params.p2` days
- **AND** BUY/SELL markers are overlaid on the candlestick series on active position changes

#### Scenario: Graceful fallback when API Ichimoku lines are NULL
- **WHEN** the API response returns null for `ichimoku_tenkan`, `ichimoku_kijun`, etc. (during warmup period at start of history)
- **THEN** those specific date points SHALL render as gaps in the line series (no line interpolation across NULL values), and candlesticks continue to render normally

### Requirement: ICHIMOKU_COMPONENTS_METADATA reflects prior system's actual formulas

The `ICHIMOKU_COMPONENTS_METADATA` constant in `IchimokuTerminal.tsx` SHALL be updated to match the exact formulas, categories, and descriptions used by the prior `quant-lttd-ichimoku` system's `features.py`:

| Key | Category | Description | Formula |
|-----|----------|-------------|---------|
| `SuperSmoother Tenkan-Kijun (S_TK)` | Cloud Momentum | Tanh-normalized TK cross delta, ATR-scaled | `tanh((Tenkan - Kijun) / ATR)` |
| `SuperSmoother Cloud Thickness (S_Cloud)` | Cloud Structure | Tanh-normalized distance from Close to cloud boundary | `tanh((Close - cloud_edge) / ATR)` |
| `SuperSmoother Future Cloud (S_Future)` | Forward Projection | Tanh-normalized Senkou A-B spread | `tanh((SenkouA - SenkouB) / ATR)` |
| `SuperSmoother Chikou Span (S_Chikou)` | Lagging Confirmation | Smoothed tanh-normalized 60-bar Chikou displacement | `tanh(SuperSmooth((Close - Close[-60]) / ATR, l=4))` |
| `Ichimoku Denoised Oscillator (IMO)` | Stationary Output | SuperSmoother-filtered equal-weight average of all 4 S-components | `SuperSmooth((S_TK + S_Cloud + S_Future + S_Chikou) / 4, l=7)` |

#### Scenario: Component metadata shows accurate formulas
- **WHEN** the IchimokuTerminal loads
- **THEN** the breakdown table SHALL display the corrected `Formula` and `DSP Transformation` strings matching the prior system's implementation, not the current placeholder descriptions

### Requirement: Component signals fetched from API for breakdown table display

The IchimokuTerminal SHALL use `quantClient.getComponents('quant-lttd-ichimoku')` to fetch the component signal breakdown for the breakdown table. When API data is unavailable, the table SHALL fall back to the latest daily IMO value. However, the `displayComponents` mapping SHALL use actual API component signal scores preferentially over the IMO-derived fallback for S_TK, S_Cloud, S_Future, S_Chikou components.

#### Scenario: Component table shows real signal scores from API
- **WHEN** `unified_component_signals` has ICHIMOKU source entries for S_TK, S_Cloud, S_Future, S_Chikou, IMO
- **THEN** the breakdown table SHALL display each component's `normalized_score` and `signal_direction` as returned by the API, with no synthetic interpolation

### Requirement: API `/api/v1/quant/daily` returns all Ichimoku fields in a single nested contract

The `ichimoku_imo` response sub-object in `GET /api/v1/quant/daily` SHALL be extended to include 9 additional fields beyond the current 3 (oscillator, regime, position). All fields SHALL be returned under the same `ichimoku_imo` parent key to preserve the existing response shape.

| Field | Type | Source (DB column) | Prior system origin |
|-------|------|--------------------|--------------------|
| `ichimoku_imo.oscillator` | number | `ichimoku_imo` | `df_ich['IMO']` |
| `ichimoku_imo.regime` | string | `ichimoku_regime` | `df_ich['Regime']` |
| `ichimoku_imo.position` | number | `ichimoku_position` | `df_ich['Pos']` |
| `ichimoku_imo.s_tk` | number | `ichi_s_tk` | `df_ich['S_TK']` |
| `ichimoku_imo.s_cloud` | number | `ichi_s_cloud` | `df_ich['S_Cloud']` |
| `ichimoku_imo.s_future` | number | `ichi_s_future` | `df_ich['S_Future']` |
| `ichimoku_imo.s_chikou` | number | `ichi_s_chikou` | `df_ich['S_Chikou']` |
| `ichimoku_imo.tenkan` | number | `ichi_tenkan` | `df_ich['tenkan_sen']` |
| `ichimoku_imo.kijun` | number | `ichi_kijun` | `df_ich['kijun_sen']` |
| `ichimoku_imo.senkou_a` | number | `ichi_senkou_a` | `df_ich['senkou_span_a']` |
| `ichimoku_imo.senkou_b` | number | `ichi_senkou_b` | `df_ich['senkou_span_b']` |
| `ichimoku_imo.chikou` | number | `ichi_chikou` | computed from shifted Close |

#### Scenario: API response includes all 12 Ichimoku fields per row
- **WHEN** the daily analytics endpoint returns data
- **THEN** every row's `ichimoku_imo` object SHALL contain all 12 fields (oscillator, regime, position, s_tk, s_cloud, s_future, s_chikou, tenkan, kijun, senkou_a, senkou_b, chikou), with `null` values for warmup dates where the prior system has not yet computed valid values

#### Scenario: NULL values serialized as JSON null not omitted keys
- **WHEN** an Ichimoku field is NULL in the database (warmup period)
- **THEN** the JSON response SHALL include the key with value `null` (not omit the key) so the FE can distinguish "API returned null" from "field doesn't exist"

### Requirement: FE `DailyAnalyticsPoint` type includes all Ichimoku line fields

The `DailyAnalyticsPoint` interface in `web/src/api/types.ts` SHALL be extended with 5 new optional numeric fields: `ichimoku_tenkan?`, `ichimoku_kijun?`, `ichimoku_senkou_a?`, `ichimoku_senkou_b?`, `ichimoku_chikou?`. The existing `ichimoku_s_tk?`, `ichimoku_s_cloud?`, `ichimoku_s_future?`, `ichimoku_s_chikou?` fields SHALL be retained unmodified.

#### Scenario: All Ichimoku fields accessible in DailyAnalyticsPoint
- **WHEN** TypeScript compiles components that destructure `ichimoku_tenkan`, `ichimoku_kijun`, `ichimoku_senkou_a`, `ichimoku_senkou_b`, `ichimoku_chikou` from a `DailyAnalyticsPoint`
- **THEN** the types SHALL compile without errors

### Requirement: FE `getDailyAnalytics()` maps all 12 Ichimoku fields from API response

The `getDailyAnalytics()` function in `web/src/api/client.ts` SHALL extend its mapping to read all 12 Ichimoku fields from the `item.ichimoku_imo` nested API object and populate the flat `DailyAnalyticsPoint` fields:

```ts
ichimoku_imo: item.ichimoku_imo?.oscillator ?? 0,
ichimoku_s_tk: item.ichimoku_imo?.s_tk,
ichimoku_s_cloud: item.ichimoku_imo?.s_cloud,
ichimoku_s_future: item.ichimoku_imo?.s_future,
ichimoku_s_chikou: item.ichimoku_imo?.s_chikou,
ichimoku_tenkan: item.ichimoku_imo?.tenkan,
ichimoku_kijun: item.ichimoku_imo?.kijun,
ichimoku_senkou_a: item.ichimoku_imo?.senkou_a,
ichimoku_senkou_b: item.ichimoku_imo?.senkou_b,
ichimoku_chikou: item.ichimoku_imo?.chikou,
```

#### Scenario: All Ichimoku fields mapped from API to DailyAnalyticsPoint
- **WHEN** `getDailyAnalytics()` processes an API response containing the full `ichimoku_imo` object
- **THEN** the returned `DailyAnalyticsPoint[]` SHALL have all 12 Ichimoku fields populated from the nested API structure

#### Scenario: Graceful NULL handling in client mapping
- **WHEN** the API returns `null` for any Ichimoku field (warmup period)
- **THEN** the corresponding `DailyAnalyticsPoint` field SHALL be `undefined` (omitted) so the FE can use `ichimoku_s_tk != null` checks safely

### Requirement: Equity Curve Subplot Uses API Reference Data and 3-Pane Layout

The Cumulative Equity Growth subplot (now Pane 3) SHALL render reference strategy and market curves sourced from the API:
- `ichimoku_cum_strat` — green, labeled "Strategy (Net)"
- `ichimoku_cum_market` — grey, labeled "BTC Buy & Hold"

The interactive `useStudioBacktest` curve SHALL be preserved as a toggleable overlay labeled "Interactive (What-If)", hidden by default. The metrics grid above the chart SHALL display reference metrics by default, switching to interactive metrics when the "Show What-If" toggle is activated.

#### Scenario: Pane 3 shows reference equity by default
- **WHEN** IchimokuTerminal mounts with `dailyData` containing populated `ichimoku_cum_strat` and `ichimoku_cum_market`
- **THEN** the equity subplot (Pane 3) SHALL display two line series with the reference labels
- **AND** the interactive backtest curve SHALL NOT be visible by default

#### Scenario: Metrics grid defaults to reference values
- **WHEN** IchimokuTerminal mounts with data containing non-null `ichimoku_strat_net_ret`
- **THEN** the metrics grid SHALL display reference-computed metrics
- **AND** the displayed Win Rate, Sharpe Ratio, Max Drawdown etc. SHALL match `calculate_metrics()` from the prior system within tolerance

#### Scenario: Interactive backtest renders on user toggle
- **WHEN** the user clicks a toggle button labeled "Show What-If"
- **THEN** the `useStudioBacktest` curve SHALL appear as a third line series with label "Interactive (What-If)"
- **AND** the reference curves SHALL remain visible
- **AND** the metrics grid SHALL switch to displaying interactive-computed metrics

#### Scenario: Vertical crosshair synchronization and 85px Y-axis lock maintained across all 3 active subplots (Pane 1, Pane 2, Pane 3)
- **WHEN** the user moves the cursor over any of the 3 active subplots (`btcChart`, `imoChart`, `eqChart`)
- **THEN** vertical crosshairs (`syncCrosshairs`) SHALL align perfectly across all panes without horizontal time-tick drift due to strict `rightPriceScale: { minimumWidth: 85 }` width locking

### Requirement: Ichimoku Denoised Oscillator Subplot Renders Entropy, ER, and Adaptive Threshold Gates

The Ichimoku Denoised Oscillator Subplot (now Pane 2: Denoising Gates & Entropy Oscillator) SHALL be rebuilt to plot exactly 4 series matching the prior system's oscillator chart:
1. `imo` (Ichimoku Denoised Oscillator: line series, amber, `#fbbf24`, value equals `ichimoku_imo`)
2. `thresh` (Entry Threshold: dashed line series, grey, `#9ca3af`, value equals `ichimoku_imo_std * params.t_entry`)
3. `entropy` (Shannon Entropy: line series, purple, `#a78bfa`, value equals `ichimoku_entropy`)
4. `chikou` (S_Chikou: line series, cyan, `#22d3ee`, value equals `ichimoku_s_chikou`)

Furthermore, Pane 2 SHALL render two dynamic price lines to indicate parameter thresholds:
- `Entropy Limit` at `params.entropy_thresh`
- `Chikou Exit` at `params.chikou_exit`

#### Scenario: Gating indicators and S_Chikou render on Pane 2
- **WHEN** `IchimokuTerminal` loads daily analytics containing `ichimoku_imo`, `ichimoku_imo_std`, `ichimoku_entropy`, and `ichimoku_s_chikou`
- **THEN** the `imoChart` renders the `imo`, `thresh`, `entropy`, and `chikou` series with matching styling and colors
- **AND** the threshold price lines for `Entropy Limit` and `Chikou Exit` are drawn at their respective parameter coordinates

### Requirement: Ichimoku Studio Incorporates Dedicated Trading Subplot and Table

The `IchimokuTerminal` component SHALL incorporate the client-side dynamic `useStudioBacktest` engine to render a dedicated 3rd equity curve subplot (`eqChart`) and a bottom completed trades log table (`trades-table`) with interactive date range and fee friction (`bps`) sliders.

The backtest engine SHALL support two modes:
- **Reference mode** (default): uses `ichimoku_strat_net_ret` and `ichimoku_active_pos` from the API for metric computation, producing values bit-exact with the Python backend
- **Interactive mode** (toggle): recomputes from `ichimoku_position × close × feeBps`, allowing fee friction exploration

#### Scenario: Dynamic calculation over user-selected start and end dates
- **WHEN** the user modifies start/end dates in `IchimokuTerminal`
- **THEN** the `eqChart` and `trades-table` recalculate in real-time without making redundant API requests, displaying exact cumulative returns and exit attributions for that window
- **AND** when in reference mode, the recalculated metrics SHALL match `calculate_metrics()` restricted to the same window
