## Context

Our multi-layered quantitative platform (`quant.maftia.tech`) ingests market data and runs four unified quantitative systems: `quant-btc-valuation-system`, `quant-btc-lttd-system`, `quant-btc-mttd-system`, and `quant-lttd-ichimoku`. During our gap analysis comparing our Ichimoku terminal against its canonical standalone reference (`quant-lttd-ichimoku`), we discovered that while `features.py` calculates `df['Entropy']` (`shannon_entropy`), `df['ER']` (`Efficiency Ratio`), and `df['IMO_Std']` (`rolling standard deviation`), our orchestration script (`run_report_pipeline.py`) omits these three columns when populating `ich_data_all` and `unified_daily_analytics`.

Consequently, our API (`/api/v1/quant/daily`) does not serve `entropy`, `er`, or `imo_std` for Ichimoku, leaving `IchimokuTerminal.tsx` unable to render the critical Layer 3 Shannon Entropy gate (`< 2.271`), Layer 2 Efficiency Ratio (`> 0.25`), and adaptive entry threshold (`T_ENTRY = 0.40 * IMO_Std`). Furthermore, across all four studios (`ValuationStudio`, `LttdLab`, `MttdConsole`, `IchimokuTerminal`), the UI currently lacks true quantitative trading terminal capabilities:
1. Candlestick BUY and SELL price markers (`arrowUp`/`arrowDown`) marking causal $t-1$ execution.
2. A dedicated equity curve subplot (`Cum_Strat` vs. `Cum_Market`).
3. Dynamic client-side date window slicing and transaction cost compounding (`useStudioBacktest`).
4. An interactive bottom trade execution table (`trades-table`) logging every completed trade and its exact exit reason (`Chikou Exit`, `Macro Exit`, `Circuit Breaker: LTTD Sideways`, `Circuit Breaker: Valuation Bubble`).

## Goals / Non-Goals

**Goals:**
- Add `ichi_entropy`, `ichi_er`, and `ichi_imo_std` columns to `unified_daily_analytics` via safe `ALTER TABLE` migrations and update `run_report_pipeline.py` to extract and store them from `df_ich`.
- Expose `entropy`, `er`, and `imo_std` within `ichimoku_imo` in `/api/v1/quant/daily` (via our Hono v4 + Bun API Gateway on `:8765`).
- Update `IchimokuTerminal.tsx` (`imoChart` or dedicated gating panel) to overlay `entropy` (purple `#a78bfa` with `2.271` limit), `er`, and adaptive threshold (`0.40 * imo_std`).
- Create `web/src/lib/studioBacktest.ts` (`useStudioBacktest` hook) to vectorize daily returns (`Active_Pos[i] = pos[i-1]`), compound equity curves (`Cum_Strat` vs `Cum_Market`) from any user-sliced start/end dates, deduct round-trip transaction costs (`bps`), and extract completed trade objects (`ID`, `Entry Date`, `Entry Price`, `Exit Date`, `Exit Price`, `Return`, `Hold Days`, `Exit Reason`).
- Add a dedicated 4th `lightweight-charts` container (`eqChart`) and bottom trade table (`trades-table`) to all four quantitative studios (`ValuationStudio`, `LttdLab`, `MttdConsole`, `IchimokuTerminal`).
- Strictly enforce the `85px` right Y-axis width lock (`syncYAxisWidth`) across all 4 subplots (`btcChart`, `imoChart`, `scompChart`, `eqChart`) and maintain vertical crosshair synchronization (`CrosshairMode.Normal`).

**Non-Goals:**
- Changing underlying mathematical formulas in `quant-lttd-ichimoku/src/ichimoku_quant/features.py` or other core engines.
- Creating ad-hoc backend servers or bypassing the single Bun API Gateway on port `:8765`.
- Re-introducing deprecated components (`quant-technical-indicator-bank`).

## Decisions

### Decision 1: Client-Side Dynamic Compounding (`useStudioBacktest`) vs. Pre-computed Backend Curves
**Choice:** Implement a pure TypeScript client-side dynamic execution hook (`useStudioBacktest`).
**Rationale:** Users need interactive control over the start/end date range and transaction fee friction (`0 to 50 bps`) inside each studio. Pre-compounding equity curves on the server prevents real-time slider updates without triggering high-frequency network requests. Because daily history ($\approx 4,000$ daily bars) is already cached in memory upon studio load, vectorized compounding in TypeScript takes $< 2\text{ms}$.
**Alternatives Considered:** Adding `/api/v1/backtest/dynamic` endpoint. Rejected due to unnecessary network overhead and loss of instant client-side slider reactivity.

### Decision 2: Dedicated 4th Subplot (`eqChart`) vs. Overlaying Equity on Price Pane
**Choice:** Add a dedicated 4th subplot (`eqChart`) below the indicator panes.
**Rationale:** Overlaying percentage returns (`+4,138%`) on a price pane scaling from `$100` to `$100,000` causes severe scale compression and vertical label clutter. A dedicated equity subplot (`height: 21%`) provides clean visual comparison between Strategy Net Return (`Cum_Strat`) and BTC Buy & Hold (`Cum_Market`).
**Alternatives Considered:** Toggle switch inside `btcChart` between Price vs. Equity. Rejected because traders require simultaneous visibility into price action, indicator momentum, and cumulative equity drawdowns.

### Decision 3: Explicit Column Migrations for Ichimoku Entropy, ER, and Standard Deviation
**Choice:** Add `ichi_entropy`, `ichi_er`, and `ichi_imo_std` directly to `unified_daily_analytics` in `maftia_quant.db`.
**Rationale:** Storing these metrics in `unified_daily_analytics` alongside `ichimoku_imo` preserves our single relational source of truth and allows rapid single-pass querying via `/api/v1/quant/daily`.

## Risks / Trade-offs

- **[Risk: Y-Axis Width Drift across 4 Subplots]** $\rightarrow$ **Mitigation:** Every studio MUST call our existing `syncYAxisWidth` utility across `[btcChart, imoChart, scompChart, eqChart]` using double `requestAnimationFrame` and `ResizeObserver` callbacks to strictly enforce the `85px` right Y-axis alignment.
- **[Risk: SQLite Column Count Mismatch during Upsert]** $\rightarrow$ **Mitigation:** All `INSERT OR REPLACE INTO unified_daily_analytics (...) VALUES (...)` statements in `run_report_pipeline.py` MUST explicitly name all 28 columns (including `ichi_entropy`, `ichi_er`, `ichi_imo_std`) to prevent `OperationalError: table X has N columns but M values were supplied`.

## Migration Plan

1. **Database Schema Update:** Update `run_report_pipeline.py` to execute `ALTER TABLE unified_daily_analytics ADD COLUMN ichi_entropy REAL; ALTER TABLE unified_daily_analytics ADD COLUMN ichi_er REAL; ALTER TABLE unified_daily_analytics ADD COLUMN ichi_imo_std REAL;` during table initialization.
2. **Pipeline Re-sync:** Execute `python3 run_report_pipeline.py` to backfill historical `ichi_entropy`, `ichi_er`, and `ichi_imo_std` from `df_ich`.
3. **API & Frontend Deployment:** Deploy updated `src/api/routes/daily.ts` (returning new fields) and `web/src/components/studios/*.tsx` with `useStudioBacktest` integration.
