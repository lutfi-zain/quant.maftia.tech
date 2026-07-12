## ADDED Requirements

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

#### Scenario: Dynamic calculation over user-selected start and end dates
- **WHEN** the user drags the date range slider or modifies start/end dates in `IchimokuTerminal`
- **THEN** the `eqChart` and `trades-table` recalculate in real-time without making redundant API requests, displaying exact cumulative returns and exit attributions (`Chikou Exit`, `Macro Exit`, or `Circuit Breaker: LTTD Sideways`) for that window
