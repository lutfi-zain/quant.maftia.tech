## 1. Pipeline: Extract Pure Reference Position and Equity Curves

- [x] 1.1 Import `run_backtest` from `quant-lttd-ichimoku.src.ichimoku_quant.backtest` in `run_report_pipeline.py` and call it after `generate_signals()` to add `Cum_Strat`, `Cum_Market` columns to `df_ich`
- [x] 1.2 Extend `ich_data_all` dictionary in `run_report_pipeline.py` to extract `Pos` (as `ref_pos`), `Cum_Strat`, and `Cum_Market` from `df_ich` — extracted BEFORE macro override logic
- [x] 1.3 Update the `CREATE TABLE IF NOT EXISTS unified_daily_analytics` statement to add `ichi_ref_pos REAL`, `ichi_cum_strat REAL`, `ichi_cum_market REAL` columns
- [x] 1.4 Update the `INSERT OR REPLACE INTO unified_daily_analytics (...)` statement to include all 3 new reference columns from `ich_data_all`, using parameterized queries and WAL connections
- [x] 1.5 Add ICHIMOKU_REFERENCE component signal sync to `unified_component_signals` section: for each date, insert REF_POS, CUM_STRAT, CUM_MARKET rows with `system_source = 'ICHIMOKU_REFERENCE'`

## 2. API Gateway: Extend Daily Route with Reference Fields

- [x] 2.1 Update `src/api/routes/daily.ts` SELECT query to include `ichi_ref_pos`, `ichi_cum_strat`, `ichi_cum_market` from `unified_daily_analytics`
- [x] 2.2 Update the response mapping in `daily.ts` to add `ref_pos`, `cum_strat`, `cum_market` fields under the `ichimoku_imo` sub-object
- [x] 2.3 Ensure NULL handling: when DB returns NULL for any reference field, the JSON response MUST include the key with value `null` (not omit the key)

## 3. FE Types: Add Reference Equity Fields

- [x] 3.1 Add `ichimoku_ref_pos?`, `ichimoku_cum_strat?`, `ichimoku_cum_market?` optional number fields to the `DailyAnalyticsPoint` interface in `web/src/api/types.ts`

## 4. FE Client: Map Reference Equity Fields from API

- [x] 4.1 Update `web/src/api/client.ts` `getDailyAnalytics()` mapping to read `ichimoku_imo.ref_pos` → `ichimoku_ref_pos`, `ichimoku_imo.cum_strat` → `ichimoku_cum_strat`, `ichimoku_imo.cum_market` → `ichimoku_cum_market`

## 5. FE Terminal: Rebuild Equity Subplot with API Reference Data

- [x] 5.1 Update Pane 4 chart initialization in `IchimokuTerminal.tsx` to read reference equity curves from `ichimoku_cum_strat` and `ichimoku_cum_market` in `dailyData` as the default data source
- [x] 5.2 Add toggle control for interactive backtest overlay: `useStudioBacktest` curve becomes a third line series visible only when user toggles "Show What-If"
- [x] 5.3 Add legend labels differentiating reference curves ("Cum_Strat (Reference)", "Cum_Market (BTC Reference)") from interactive overlay ("Interactive (What-If)")

## 6. FE Backtest Engine: Fix Fee Model

- [x] 6.1 Fix fee deduction in `web/src/lib/studioBacktest.ts`: change `stratRet -= feeRate / 2.0` to `stratRet -= feeRate` (full half-turn fee on position change, matching Python's `Active_Pos.diff().abs() * transaction_cost`)
- [x] 6.2 Verify default `feeBps` is 10 (10 bps = 0.001), matching the prior system's `transaction_cost=0.001`

## 7. Verification: Add Equity Curve Parity Checks

- [x] 7.1 Update `verify_pipeline_api_parity.py` with cumulative return parity check: compare final `ichi_cum_strat` value against prior system's `Cum_Strat.iloc[-1]` within tolerance $10^{-4}$
- [x] 7.2 Add Sharpe ratio parity check: compute from `Cum_Strat` daily differences and compare against prior system's `calculate_metrics()` output
- [x] 7.3 Add max drawdown parity check: `|prior_mdd - pipeline_mdd| < 0.5` percentage points
- [x] 7.4 Add trade count parity check: count position transitions in `ichi_ref_pos` vs prior system's trade count
- [x] 7.5 Add override detection check: verify `ichi_ref_pos != ichimoku_position` on override dates; verify equality on non-override dates

## 8. Pipeline Execution & Full Verification

- [x] 8.1 Run `python3 /home/ubuntu/projects/run_report_pipeline.py` and confirm no errors
- [x] 8.2 Query `unified_daily_analytics` to confirm `ichi_ref_pos`, `ichi_cum_strat`, `ichi_cum_market` are populated with real values (not NULL) for all dates covered by the prior system
- [x] 8.3 Query `unified_component_signals` to confirm ICHIMOKU_REFERENCE source entries exist
- [x] 8.4 Start API Gateway and verify `/api/v1/quant/daily` returns the new reference fields in `ichimoku_imo`
- [x] 8.5 Run `verify_pipeline_api_parity.py` and confirm all equity curve checks pass
- [x] 8.6 FE visual verification — code changes complete; open browser to confirm Pane 4 shows reference equity curve with interactive toggle IchimokuTerminal Pane 4 shows the reference equity curve matching the prior system's output — interactive toggle functions correctly
