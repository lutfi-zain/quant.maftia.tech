## Why

The current Ichimoku terminal interface in the unified terminal contains 4 subplots, introducing unnecessary visual complexity by splitting the denoising/entropy components and leading momentum vectors into two separate panes. In contrast, the prior system (in `quant-lttd-ichimoku`) combined these indicators into a single, unified "Denoising Gates & Entropy Oscillator" subplot. Aligning the terminal's charts 1:1 with the prior system will simplify the user interface, bring layout parity, and ensure that the interactive parameter tuning is visually intuitive and aligned with the prior design context.

## What Changes

- **Consolidate Subplots from 4 to 3**:
  - **Pane 1**: BTC/USD Price Action & Ichimoku Overlay (Candlesticks, Tenkan-sen, Kijun-sen, Senkou Span A, Senkou Span B, Traditional Chikou Span, and BUY/SELL markers).
  - **Pane 2**: Denoising Gates & Entropy Oscillator (IMO oscillator, Entry Threshold, Shannon Entropy, and S_Chikou).
  - **Pane 3**: Cumulative Equity Growth (Strategy Net vs BTC Buy & Hold reference and optional interactive what-if curves).
- **Remove Pane 3 (Lagging & Leading Momentum Vectors)**: Eliminate the separate s-component chart, merging `S_Chikou` into the Denoising Gates & Entropy Oscillator (Pane 2) and removing `S_TK`, `S_Cloud`, and `S_Future` series to match the prior system's visualizations.
- **Add Traditional Chikou Span to Pane 1**: Add the traditional Chikou Span (lagged close by `params.p2` days, default 26) as a purple line on the price chart.
- **Add Parameter Reference Lines to Pane 2**: Plot dynamic threshold lines for `Entropy Limit` (at `entropy_thresh`) and `Chikou Exit` (at `chikou_exit`) dynamically updated on parameters change.
- **Update Height Calculations**: Modify `getPanelHeights()` and responsive resizing logic to support the new 3-pane layout, allocating heights proportionally for normal and maximized panel states.
- **Synchronize Scales and Formatting**: Enforce the `85px` Y-axis width lock and horizontal crosshair sync across all 3 panes.

## Capabilities

### New Capabilities
*None*

### Modified Capabilities
- `ichimoku-chart-rebuild`: Update the chart layout and series rendering specifications to match the 3-pane prior system.

## Impact

- **Affected Code**: `web/src/components/studios/IchimokuTerminal.tsx` (all chart references, container refs, heights, series creation, series data loading, and event listener setups).
- **APIs and Database**: No database changes or backend API changes are needed, as the daily analytics data endpoint already yields the necessary fields (such as `ichimoku_entropy`, `ichimoku_imo`, `ichimoku_chikou`, `ichimoku_cum_strat`, `ichimoku_cum_market`).
- **Dependencies**: No new npm or python dependencies are introduced.

## Non-goals

- Deprecated systems such as `quant-technical-indicator-bank` will remain completely untouched.
- Core math and execution pipeline scripts (like `run_report_pipeline.py`) are out of scope and will not be modified.
- No changes to the Valuation, LTTD, or MTTD systems or their corresponding dashboards.

## System Impact

Only the **Ichimoku** system (specifically the frontend visualization terminal) is impacted by this change.

## Lookahead Bias Confirmation

We confirm that all math, rendering, and logic verification operate strictly causally (at `t-1` stamp verification) with zero lookahead bias.
