## Context

The current `IchimokuTerminal.tsx` frontend component displays 4 separate subplots (`btcChart`, `imoChart`, `scompChart`, `eqChart`) within a vertical grid. The prior system (`quant-lttd-ichimoku` App.jsx) operates with a more streamlined 3-pane layout, where the denoising metrics, entry thresholds, Shannon Entropy, and the lagging Chikou confirmation are plotted on a single merged oscillator chart. This design document establishes the blueprint to consolidate the terminal to 3 subplots and ensure 1:1 parity with the prior system.

## Goals / Non-Goals

**Goals:**
- Rebuild the Ichimoku Terminal chart interface using exactly 3 subplots:
  1. **BTC/USD Price Action & Ichimoku Overlay**
  2. **Denoising Gates & Entropy Oscillator**
  3. **Cumulative Equity Growth**
- Plot the traditional Chikou Span (displaced forward by `params.p2` days) on the price action subplot.
- Merge `S_Chikou` into the Denoising Gates & Entropy Oscillator subplot (Pane 2) and plot it alongside the Denoised IMO, Shannon Entropy, and Entry Threshold.
- Add dynamic parameter lines (`Entropy Limit` at `params.entropy_thresh` and `Chikou Exit` at `params.chikou_exit`) on the oscillator chart.
- Enforce the `85px` right Y-axis width lock and crosshair/logical range synchronization across all 3 subplots.
- Ensure all charts remain highly responsive on both desktop and mobile viewports.

**Non-Goals:**
- No changes to the database schema or the python ingestion/report pipeline (`run_report_pipeline.py`).
- No adjustments or edits to the Valuation, LTTD, or MTTD systems.
- No re-introduction of the deprecated `quant-technical-indicator-bank` project references.

## Decisions

### Decision 1: Consolidated 3-Pane Layout
- **Approach**: Eliminate `scompContainerRef` and the third subplot container from the DOM in `IchimokuTerminal.tsx`. Refactor `getPanelHeights()` to allocate vertical spacing only across 3 panes:
  - **Normal Mode**: Price = 350px, Oscillator = 200px, Equity = 220px. (Mobile: Price = 250px, Oscillator = 150px, Equity = 160px).
  - **Maximized Mode**: 
    - Maximized Price: Price = `Math.floor((available - 56) * 0.65)`, Oscillator = `available - 56 - Price`, Equity = 0.
    - Maximized Oscillator: Price = `Math.floor((available - 56) * 0.55)`, Oscillator = `Math.floor((available - 56) * 0.45)`, Equity = 0.
    - Maximized Equity: Price = `Math.floor((available - 56) * 0.55)`, Oscillator = 0, Equity = `Math.floor((available - 56) * 0.45)`.
- **Rationale**: Direct alignment with the prior system's heights and viewport distribution, preventing chart heights from collapsing to zero during pane maximization.
- **Alternatives**: Keeping the 4 containers in DOM and setting height to 0 for Pane 3. However, this leaves dead DOM elements and pollutes the rendering loop.

### Decision 2: Consolidation of Denoising Gates & Entropy Oscillator (Pane 2)
- **Approach**: Instantiate `imoSeries` (Amber), `threshSeries` (Dashed Grey, value is `ichimoku_imo_std * params.t_entry`), `entropySeries` (Purple), and `chikouSeries` (Cyan, mapping `ichimoku_s_chikou`) on the single `oscChart`.
- **Rationale**: Groups all statistical denoising gates into one visual coordinate space, making the entry/exit rules intuitive to analyze.
- **Alternatives**: Retaining a separate S-components pane. However, this causes visual clutter and does not match the prior system's design.

### Decision 3: Client-side Traditional Chikou Calculation (Pane 1)
- **Approach**: On the price action chart, plot `traditionalChikouSeries` (Purple, solid) using the close price shifted forward by `params.p2` days (e.g. `timeseries[i + params.p2].Close` at index `i`).
- **Rationale**: Replicates the prior system's price-displaced Chikou visualization without adding extra DB query overhead.
- **Alternatives**: Querying a pre-computed lagging series from the API. However, this is redundant as the close price is already fully cached in memory.

### Decision 4: Price Line Thresholds in Pane 2
- **Approach**: Create and dynamically update the two price lines (`entropyLimit` and `chikouExit`) on `entropySeries` and `chikouSeries` respectively inside a parameter-dependent `useEffect`.
- **Rationale**: Visualizes parameter levels dynamically, matching the behavior in `quant-lttd-ichimoku`.

## Risks / Trade-offs

- **[Risk]** Consolidating the oscillator chart makes it crowded (4 series).
  - *Mitigation*: Enable explicit styling controls and tooltips to easily identify individual curves.
- **[Risk]** Horizontal scale drift across the remaining 3 subplots.
  - *Mitigation*: Ensure `rightPriceScale: { minimumWidth: 85 }` is applied on all charts and execute `syncYAxisWidth` on initialization and resizing.
