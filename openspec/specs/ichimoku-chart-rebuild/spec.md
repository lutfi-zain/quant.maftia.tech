# ichimoku-chart-rebuild Specification

## Purpose

Defines requirements for the 4-pane Ichimoku quantitative chart rebuild, including API-provided Ichimoku price-level lines at authoritative hyper-tuned periods (20, 60, 120), API-sourced causal S-components without synthetic fallbacks, accurate component metadata/signals, and reference vs strategy equity curve comparison with interactive What-If overlays.
## Requirements
### Requirement: Ichimoku Terminal reads Tenkan/Kijun from API

The IchimokuTerminal SHALL read Tenkan-sen, Kijun-sen, Senkou Span A, Senkou Span B, and Chikou Span values from the API-provided `DailyAnalyticsPoint` fields (`ichimoku_tenkan`, `ichimoku_kijun`, `ichimoku_senkou_a`, `ichimoku_senkou_b`, `ichimoku_chikou`) instead of computing them client-side.

Client-side Ichimoku line computation (`computeIchimokuLines()`) using hardcoded periods (9, 26, 52) SHALL be removed. The FE SHALL NOT recompute Ichimoku cloud components from OHLCV data.

The authoritative periods used by the prior system (`quant-lttd-ichimoku`) and served through the pipeline are:
- Tenkan-sen: 20-period midpoint (was 9)
- Kijun-sen: 60-period midpoint (was 26)
- Senkou Span A: (Tenkan + Kijun) / 2, shifted by 60 bars (was 26)
- Senkou Span B: 120-period midpoint (was 52), shifted by 60 bars
- Chikou Span: Close displaced back by 60 bars (was 26)

All line styling (colors, widths, opacity) SHALL remain unchanged. Only the data source and periods change. Furthermore, the displayed numerical values on the chart crosshair and hover tooltips MUST match 1:1 with `df_ich` from `quant-lttd-ichimoku` within $|a - b| < 10^{-6}$.

#### Scenario: Ichimoku lines render on BTC pane from API data
- **WHEN** IchimokuTerminal loads with daily data that includes `ichimoku_tenkan`, `ichimoku_kijun`, `ichimoku_senkou_a`, `ichimoku_senkou_b`, `ichimoku_chikou` fields
- **THEN** Tenkan (red, `#F87171`) and Kijun (blue, `#60A5FA`) lines appear overlaid on BTC candlesticks using API-provided values, and Span A (`rgba(34,197,94,0.35)`) / Span B (`rgba(239,68,68,0.35)`) lines form a visible cloud structure
- **AND** the chart SHALL filter out NULL values (warmup period) using `filter(d => d.value != null)`

#### Scenario: Chikou Span rendered with prior system's displacement
- **WHEN** IchimokuTerminal loads
- **THEN** the Chikou Span (purple, `rgba(168,85,247,0.55)`, line style Dotted) represents the prior system's chikou value (60-bar displacement, Ehlers SuperSmoother filtered) as returned by the API

#### Scenario: Graceful fallback when API Ichimoku lines are NULL
- **WHEN** the API response returns null for `ichimoku_tenkan`, `ichimoku_kijun`, etc. (during warmup period at start of history)
- **THEN** those specific date points SHALL render as gaps in the line series (no line interpolation across NULL values), and candlesticks continue to render normally

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

### Requirement: Equity Curve Subplot Uses API Reference Data and 4-Pane Layout

The equity curve subplot (Pane 4 in the 4-pane layout) SHALL render two line series sourced from API-provided reference equity fields:

- `ichimoku_cum_strat` — green (`#22C55E`), labeled "Cum_Strat (Reference)"
- `ichimoku_cum_market` — blue (`#3B82F6`), labeled "Cum_Market (BTC Reference)"

The interactive `useStudioBacktest` curve SHALL be preserved as a toggleable overlay labeled "Interactive (What-If)", NOT as the default data source.

The metrics grid above the equity curve SHALL display reference metrics computed from `ichimoku_strat_net_ret` by default. When the interactive toggle is activated, the metrics grid SHALL switch to displaying interactive-computed metrics.

#### Scenario: Pane 4 shows reference equity by default

- **WHEN** IchimokuTerminal mounts with `dailyData` containing populated `ichimoku_cum_strat` and `ichimoku_cum_market`
- **THEN** the equity subplot SHALL display two line series with the reference labels
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

#### Scenario: Vertical crosshair synchronization and 85px Y-axis lock maintained across all 4 panes

- **WHEN** the user moves the cursor over any of the 4 panes (`btcChart`, `oscChart`, `sCompChart`, `eqChart`)
- **THEN** vertical crosshairs (`syncCrosshairs`) SHALL align perfectly across all panes without horizontal time-tick drift due to strict `rightPriceScale: { minimumWidth: 85 }` width locking

### Requirement: Ichimoku Denoised Oscillator Subplot Renders Entropy, ER, and Adaptive Threshold Gates
The `IchimokuTerminal` component SHALL update its `imoChart` (or dedicated gating indicators subplot) to render the three gating series derived from `ichimoku_imo.entropy`, `ichimoku_imo.er`, and `ichimoku_imo.imo_std` returned by `/api/v1/quant/daily`. Specifically, the studio MUST render:
1. `Entropy Gate`: A purple (`#a78bfa`) line series for `entropy` alongside a horizontal limit line at `2.271` (`shannon_entropy` upper threshold).
2. `Efficiency Ratio Gate`: A line/bar representation for `er` checking trend vs. noise (`> 0.25`).
3. `Adaptive Volatility Threshold`: A blue (`#3b82f6`) line series for `0.40 * imo_std` representing the adaptive entry threshold `T_ENTRY`.

#### Scenario: All gating metrics render on Ichimoku studio
- **WHEN** `IchimokuTerminal` loads daily analytics containing `ichimoku_imo.entropy`, `ichimoku_imo.er`, and `ichimoku_imo.imo_std`
- **THEN** the `imoChart` (or gating panel) overlays the `entropy` series with its `2.271` limit and plots the adaptive threshold (`0.40 * imo_std`), accurately visualizing why a trade entry was permitted or vetoed

### Requirement: Ichimoku Studio Incorporates Dedicated Trading Subplot and Table

The `IchimokuTerminal` component SHALL incorporate the client-side dynamic `useStudioBacktest` engine to render a dedicated 4th equity curve subplot (`eqChart`) and a bottom completed trades log table (`trades-table`) with interactive date range and fee friction (`bps`) sliders.

The backtest engine SHALL support two modes:

- **Reference mode** (default): uses `ichimoku_strat_net_ret` and `ichimoku_active_pos` from the API for metric computation, producing values bit-exact with the Python backend
- **Interactive mode** (toggle): recomputes from `ichimoku_position × close × feeBps`, allowing fee friction exploration

#### Scenario: Dynamic calculation over user-selected start and end dates

- **WHEN** the user modifies start/end dates in `IchimokuTerminal`
- **THEN** the `eqChart` and `trades-table` recalculate in real-time without making redundant API requests, displaying exact cumulative returns and exit attributions for that window
- **AND** when in reference mode, the recalculated metrics SHALL match `calculate_metrics()` restricted to the same window

