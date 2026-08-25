## Why

Currently, there is confusion and inconsistency between the buy/sell markers rendered on the candlestick price charts across different views:
1. **Master Dashboard (`MultiPaneChart.tsx`)**: Draws `VAL ACCUM` (Cyan arrow below bar) when `valuation_composite >= +1.0 AND lttd_regime == 'BULL'`, and `VAL BUBBLE` (Magenta arrow above bar) when `valuation_composite <= -1.5 AND lttd_regime == 'BEAR'`. These represent **Macro System Confluence Signals**.
2. **Valuation Studio (`ValuationStudio.tsx`)**: Draws arrows representing **SDCA Portfolio Execution Orders** (`BUY_DCA`, `BUY_ALL`, `SELL_DCA`, `SELL_ALL`, `ALL_IN`, `OUT_ALL`). Sinyal `BUY_DCA` hanya muncul pada hari Senin (Monday calendar cadence).
3. **Lack of Visual Distinction**: Users visiting Valuation Studio expect to see the macro cycle zones on the chart, but instead see weekly DCA operational orders, leading to confusion when markers do not match the Master Dashboard.

This change standardizes the visual taxonomy and chart marker styling across the terminal, clearly distinguishing between **Macro System Confluence Signals** (institutional regime filters) and **Portfolio Execution Orders** (SDCA simulation transactions).

## What Changes

- **Chart Marker Taxonomy & Legend**:
  - Distinguish between **System Confluence Markers** (Diamond / Star markers: `VAL ACCUM`, `VAL BUBBLE`) and **Order Execution Markers** (Green ArrowUp / Red ArrowDown: `BUY_DCA`, `BUY_ALL`, `SELL_DCA`, `SELL_ALL`).
  - Add an interactive marker layer toggle in `ValuationStudio.tsx` allowing researchers to view "Strategy Execution Orders", "Macro Confluence Signals", or "Both".
- **Date Range & Filter Synchronization**:
  - Ensure markers on the candlestick chart dynamically filter and synchronize when the user selects date presets (1Y, 3Y, 5Y, ALL) or adjusts threshold sliders.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `studio-fe-features-and-metrics-parity`: Synchronize chart marker conventions and interactive display layers across Valuation Studio and Executive Dashboard.

## Impact & System Scope

- **Impacted Systems**: Frontend UI components (`MultiPaneChart.tsx`, `ValuationStudio.tsx`).
- **Zero Lookahead Bias**: Strictly maintained.
- **Non-Goals**:
  - No changes to underlying mathematical trade generation.
