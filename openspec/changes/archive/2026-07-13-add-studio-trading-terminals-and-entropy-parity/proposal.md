## Why

Our investigation into the Ichimoku terminal gap revealed that while our data pipeline correctly computes quantitative signals, the unified system currently discards `df_ich['Entropy']`, `df_ich['ER']`, and `df_ich['IMO_Std']` during database sync, leaving our frontend unable to display Layer 2 (Efficiency Ratio) and Layer 3 (Shannon Entropy) gating limits. Furthermore, all four deep-dive studios (`ValuationStudio`, `LttdLab`, `MttdConsole`, `IchimokuTerminal`) currently function strictly as indicator diagnostics suites rather than true quantitative trading terminals—lacking BUY/SELL price markers, dedicated equity curve subplots (`Cum_Strat` vs. `Cum_Market`), dynamic date slicing, and completed trade logs (`trades-table`). Closing these gaps establishes full parity with canonical standalone systems while empowering users to audit trade attribution under our interlocking macro circuit breakers (`LTTD SIDEWAYS` and `Valuation Bubble`).

## What Changes

- **Add Ichimoku Gating Metrics Parity**: Extract `df_ich['Entropy']` (`shannon_entropy`), `df_ich['ER']`, and `df_ich['IMO_Std']` (`thresh`) in `run_report_pipeline.py` after `generate_ichimoku_features()`, store them in new columns `ichi_entropy`, `ichi_er`, and `ichi_imo_std` inside `unified_daily_analytics`, and expose them via `/api/v1/quant/daily`.
- **Render Missing Ichimoku Gates on Chart**: Update `IchimokuTerminal.tsx` (`imoChart`) to plot `Entropy` (`< 2.271` purple gate), `ER` (`> 0.25`), and `Adaptive Volatility Threshold` (`0.40 * IMO_Std`).
- **Implement Reusable Client-Side Trading Engine (`useStudioBacktest`)**: Create a dynamic compounding and trade boundary extraction TypeScript engine (`web/src/lib/studioBacktest.ts`) that runs over any user-sliced start and end dates with configurable transaction costs (`tc`).
- **Dedicated Equity Curve Subplots Across All Studios**: Add a dedicated 4th `lightweight-charts` container (`eqChart`) to `ValuationStudio`, `LttdLab`, `MttdConsole`, and `IchimokuTerminal`, strictly adhering to our `85px` right Y-axis width lock and vertical crosshair synchronization to display Strategy Net Return vs. Buy & Hold BTC.
- **BUY / SELL Price Markers on Candlestick Subplots**: Attach `createSeriesMarkers` (`arrowUp` `#10b981` BUY and `arrowDown` `#ef4444` SELL) directly to each studio's primary `btcChart` based on causal $t-1$ position transitions (`pos[i-1]`).
- **Completed Trades Log Tables (`trades-table`)**: Add an interactive bottom trade table and KPI bar (`Win Rate (%)`, `Profit Factor`, `Total Trades`, `Sharpe Ratio`, `Max Drawdown`) per studio, attributing exact exit reasons (`Chikou Exit`, `Macro Exit`, `Circuit Breaker: LTTD Sideways`, `Circuit Breaker: Valuation Bubble`).

## Capabilities

### New Capabilities
- `studio-trading-terminals`: Client-side dynamic backtesting engine (`useStudioBacktest`), dedicated 4th equity curve subplot (`Cum_Strat` vs `Cum_Market`), candlestick BUY/SELL price markers (`arrowUp`/`arrowDown`), trade boundary extraction with circuit breaker attribution, and completed trades log table (`trades-table`) across all four quantitative studios (`ValuationStudio`, `LttdLab`, `MttdConsole`, `IchimokuTerminal`).

### Modified Capabilities
- `unified-analytics-persistence`: Add `ichi_entropy`, `ichi_er`, and `ichi_imo_std` columns to `unified_daily_analytics` table in `maftia_quant.db` using SQLite WAL concurrency.
- `data-ingestion-and-wal-pipeline`: Extract `df_ich['Entropy']`, `df_ich['ER']`, and `df_ich['IMO_Std']` in `run_report_pipeline.py` and upsert into `unified_daily_analytics` strictly preserving $t-1$ causal verification.
- `unified-api-gateway-routes`: Include `ichi_entropy`, `ichi_er`, and `ichi_imo_std` in the `/api/v1/quant/daily` response inside the `ichimoku_imo` object.
- `ichimoku-chart-rebuild`: Update `IchimokuTerminal.tsx` to render `Entropy`, `ER`, and `Threshold` lines on `imoChart`, and incorporate the dedicated equity curve subplot (`eqChart`) and trade log table.

## Impact

- **Impacted Systems**: All 4 unified quantitative systems (`quant-btc-valuation-system`, `quant-btc-lttd-system`, `quant-btc-mttd-system`, and `quant-lttd-ichimoku`).
- **Causal Integrity**: Zero lookahead bias is strictly enforced (`Active_Pos = pos[i-1]`). Position entries and exits act on the following day's return after signal generation at close $t$.
- **Backend & API**: `run_report_pipeline.py`, `maftia_quant.db` (`unified_daily_analytics`), `verify_pipeline_api_parity.py`, and Bun API Gateway `src/api/routes/daily.ts`.
- **Frontend SPA**: `web/src/lib/studioBacktest.ts` (new core engine), `web/src/components/studios/IchimokuTerminal.tsx`, `ValuationStudio.tsx`, `LttdLab.tsx`, and `MttdConsole.tsx`.

## Non-goals

- Modifying core mathematical formulas or parameters in existing subsystem engines (`features.py`, `strategy.py`, `hmmlearn` models).
- Re-introducing or referencing the deprecated `quant-technical-indicator-bank` project (`05_quant_technical_indicator_bank.md`).
- Altering the `85px` right Y-axis lock or vertical crosshair synchronization contract established across existing subplots.
