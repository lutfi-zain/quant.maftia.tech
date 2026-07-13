## 1. Database & Data Orchestration Pipeline (`quant-lttd-ichimoku` & `unified_daily_analytics`)

- [x] 1.1 Update `run_report_pipeline.py` database initialization to ensure `ichi_entropy`, `ichi_er`, and `ichi_imo_std` columns exist in `unified_daily_analytics` (`maftia_quant.db`) via safe `ALTER TABLE ADD COLUMN` migrations using SQLite WAL mode
- [x] 1.2 Update `run_report_pipeline.py` Ichimoku extraction loop (around line 383) to extract `df_ich['Entropy']`, `df_ich['ER']`, and `df_ich['IMO_Std']` into `ich_data_all[dt]`
- [x] 1.3 Update `run_report_pipeline.py` `INSERT OR REPLACE INTO unified_daily_analytics` parameterized query string and tuple builder to include `ichi_entropy`, `ichi_er`, and `ichi_imo_std` with zero lookahead bias
- [x] 1.4 Execute `python3 /home/ubuntu/projects/run_report_pipeline.py` to run the 4-system pipeline, verify clean execution without WAL lock contention, and confirm historical population of `ichi_entropy`, `ichi_er`, and `ichi_imo_std` in `maftia_quant.db`

## 2. API Gateway Routes (`api.quant.maftia.tech`)

- [x] 2.1 Update `src/api/routes/daily.ts` SELECT query and `ichimoku_imo` response mapping to return `entropy` (`ichi_entropy`), `er` (`ichi_er`), and `imo_std` (`ichi_imo_std`) alongside all existing fields
- [x] 2.2 Verify API Gateway startup and confirm `GET /api/v1/quant/daily` outputs `{ oscillator, regime, position, s_tk, s_cloud, s_future, s_chikou, tenkan, kijun, senkou_a, senkou_b, chikou, entropy, er, imo_std }` for `ichimoku_imo`

## 3. Client-Side Trading & Backtesting Core Engine (`useStudioBacktest`)

- [x] 3.1 Create `web/src/lib/studioBacktest.ts` implementing date window slicing (`start_date` to `end_date`), causal $t-1$ position transitions (`Active_Pos[i] = pos[i-1]`), round-trip transaction cost (`bps`) deduction, compounding `Cum_Strat` vs `Cum_Market` series, and trade extraction (`ID`, `Entry Date`, `Entry Price`, `Exit Date`, `Exit Price`, `Return`, `Hold Days`, `Exit Reason`)
- [x] 3.2 Add TypeScript types and helper calculations for win rate, profit factor, total trades, Sharpe ratio, and maximum drawdown in `studioBacktest.ts`

## 4. Ichimoku Studio Gating & Terminal Upgrade (`quant-lttd-ichimoku` UI)

- [x] 4.1 Update `IchimokuTerminal.tsx` (`imoChart` or dedicated gating panel) to plot `entropy` (purple `#a78bfa` with horizontal price line at `2.271`), `er` (trend gate `> 0.25`), and adaptive threshold (`0.40 * imo_std` blue line)
- [x] 4.2 Integrate `useStudioBacktest` into `IchimokuTerminal.tsx`, adding the dedicated 4th equity curve subplot (`eqChart`), candlestick BUY/SELL price markers (`arrowUp`/`arrowDown`) on `btcChart`, and bottom completed trades log table (`trades-table`)
- [x] 4.3 Enforce `syncYAxisWidth` (`85px` right scale lock) across `[btcChart, imoChart, scompChart, eqChart]` using double `requestAnimationFrame` and `ResizeObserver` with vertical crosshair synchronization

## 5. Valuation, LTTD, and MTTD Studios Terminal Upgrades

- [x] 5.1 Integrate `useStudioBacktest`, candlestick BUY/SELL markers on `btcChart`, dedicated `eqChart` subplot (`Cum_Strat` vs `Cum_Market`), and bottom trade execution table (`trades-table`) into `ValuationStudio.tsx`
- [x] 5.2 Integrate `useStudioBacktest`, candlestick BUY/SELL markers on `btcChart`, dedicated `eqChart` subplot (`Cum_Strat` vs `Cum_Market`), and bottom trade execution table (`trades-table`) into `LttdLab.tsx`
- [x] 5.3 Integrate `useStudioBacktest`, candlestick BUY/SELL markers on `btcChart`, dedicated `eqChart` subplot (`Cum_Strat` vs `Cum_Market`), and bottom trade execution table (`trades-table`) into `MttdConsole.tsx`
- [x] 5.4 Enforce `syncYAxisWidth` (`85px` lock) across all chart subplots in `ValuationStudio.tsx`, `LttdLab.tsx`, and `MttdConsole.tsx` to prevent horizontal time-tick misalignment

## 6. Final Verification & Build

- [x] 6.1 Execute `cd web && npm run build` to verify clean TypeScript compilation and UI bundle creation
- [x] 6.2 Execute `python3 /home/ubuntu/projects/run_report_pipeline.py` to confirm all 4 quantitative systems pass data orchestration and integration verification
