## MODIFIED Requirements

### Requirement: Ichimoku Terminal reads Tenkan/Kijun from API
The IchimokuTerminal SHALL read Tenkan-sen, Kijun-sen, Senkou Span A, Senkou Span B, and Chikou Span values from the API-provided `DailyAnalyticsPoint` fields (`ichimoku_tenkan`, `ichimoku_kijun`, `ichimoku_senkou_a`, `ichimoku_senkou_b`, `ichimoku_chikou`) instead of computing them client-side.

The Price Action subplot (Pane 1) SHALL also render the Traditional Chikou Span series (purple line, styled with `color: 'rgba(168, 85, 247, 0.5)'` / `'rgba(107, 33, 168, 0.45)'` depending on theme), computed on the client side by lagging the close price forward by `params.p2` days (default 26) as defined in the prior system.

The chart SHALL filter out NULL values using `.filter(d => d.value != null)`. It SHALL also overlay Buy and Sell markers on the candlestick series whenever the active position transitions (0 to 1 for Buy, 1 to 0 for Sell).

#### Scenario: Ichimoku lines render on BTC pane from API data
- **WHEN** IchimokuTerminal loads with daily data that includes `ichimoku_tenkan`, `ichimoku_kijun`, `ichimoku_senkou_a`, `ichimoku_senkou_b` fields
- **THEN** Tenkan (red) and Kijun (blue) lines appear overlaid on BTC candlesticks using API-provided values, and Span A and Span B lines form a visible cloud structure
- **AND** the traditional Chikou Span is rendered on Pane 1 using close price shifted forward by `params.p2` days
- **AND** BUY/SELL markers are overlaid on the candlestick series on active position changes

#### Scenario: Graceful fallback when API Ichimoku lines are NULL
- **WHEN** the API response returns null for `ichimoku_tenkan`, `ichimoku_kijun`, etc.
- **THEN** those specific date points SHALL render as gaps in the line series, and candlesticks continue to render normally

### Requirement: Ichimoku Denoised Oscillator Subplot Renders Entropy, ER, and Adaptive Threshold Gates
The Ichimoku Denoised Oscillator Subplot (now Pane 2: Denoising Gates & Entropy Oscillator) SHALL be rebuilt to plot exactly 4 series matching the prior system's oscillator chart:
1. `imo` (Ichimoku Denoised Oscillator: line series, amber, `#fbbf24` / `#d97706`)
2. `thresh` (Entry Threshold: dashed line series, grey, `#9ca3af` / `#787774`, value equals `ichimoku_imo_std * params.t_entry`)
3. `entropy` (Shannon Entropy: line series, purple, `#a78bfa` / `#7c3aed`, value equals `ichimoku_entropy`)
4. `chikou` (S_Chikou: line series, cyan, `#22d3ee` / `#0891b2`, value equals `ichimoku_s_chikou`)

Furthermore, Pane 2 SHALL render two dynamic price lines to indicate parameter thresholds:
- `Entropy Limit` at `params.entropy_thresh`
- `Chikou Exit` at `params.chikou_exit`

#### Scenario: Gating indicators and S_Chikou render on Pane 2
- **WHEN** IchimokuTerminal loads daily analytics data
- **THEN** Pane 2 renders the `imo`, `thresh`, `entropy`, and `chikou` series with matching styling and colors
- **AND** the threshold price lines for `Entropy Limit` and `Chikou Exit` are drawn at their respective parameter coordinates

### Requirement: Equity Curve Subplot Uses API Reference Data and 4-Pane Layout
The Cumulative Equity Growth subplot (now Pane 3) SHALL render reference strategy and market curves sourced from the API:
- `ichimoku_cum_strat` — green/cyan, labeled "Strategy (Net)"
- `ichimoku_cum_market` — grey, labeled "BTC Buy & Hold"

The interactive `useStudioBacktest` curve SHALL be preserved as a toggleable overlay labeled "Interactive (What-If)", hidden by default. The metrics grid above the chart SHALL display reference metrics by default, switching to interactive metrics when the "Show What-If" toggle is activated.

#### Scenario: Pane 3 shows reference equity by default
- **WHEN** IchimokuTerminal mounts with dailyData containing `ichimoku_cum_strat` and `ichimoku_cum_market`
- **THEN** the equity subplot (Pane 3) displays the two reference line series by default, with the what-if curve hidden
- **AND** vertical crosshair synchronization and 85px Y-axis lock are maintained across all 3 active subplots (Pane 1, Pane 2, Pane 3)

## REMOVED Requirements

### Requirement: S-Component chart pane uses API-provided values, not synthetic fallbacks
**Reason**: The separate S-Component chart pane (Pane 3 in the 4-pane layout) is removed to consolidate the interface into 3 panes. The `S_Chikou` indicator is merged into Pane 2 (Denoising Gates & Entropy Oscillator), and `S_TK`, `S_Cloud`, and `S_Future` are removed from visual plotting.
**Migration**: Remove the `scompChart` instance, its container ref, and height allocation. Merge the `sChikouSeries` into Pane 2 as `chikou`.
