## 1. Backend: LTTD Dedicated API Routes

- [x] 1.1 Create `src/api/routes/lttd.ts` with Hono router for all new endpoints
- [x] 1.2 Implement `GET /api/v1/lttd/latest` — fetch latest LTTD record from `unified_daily_analytics` with full OHLCV data, regime, and scores
- [x] 1.3 Implement `GET /api/v1/lttd/history` — fetch historical records with optional `start`/`end` date query params, default limit 500
- [x] 1.4 Implement `GET /api/v1/lttd/chart` — return price action + lttd_score + target_exposure for charting
- [x] 1.5 Implement `GET /api/v1/lttd/regime` — return daily regime probabilities (p_bull, p_bear, p_sideways) from unified data, with synthetic distribution fallback
- [x] 1.6 Implement `GET /api/v1/lttd/diagnostics` — return indicator_scores, pca_components, vif, pca_variance_explained
- [x] 1.7 Implement `GET /api/v1/lttd/onchain` — fetch on-chain metrics from `unified_component_signals` with valuation fallback
- [x] 1.8 Implement `POST /api/v1/lttd/actions/run` — spawn Python pipeline scripts via `Bun.spawn` in `/home/ubuntu/projects/quant-btc-lttd-system/`
- [x] 1.9 Register all routes in `src/api/index.ts` under `/api/v1/lttd/`
- [x] 1.10 Add CausalFilter date validation and parameterized SQL to all endpoints
- [ ] 1.11 Verify TypeScript compilation with `bun run build` in `src/`

## 2. Backend: Server-Side Backtest Endpoint

- [x] 2.1 Implement `GET /api/v1/lttd/backtest` in `src/api/routes/lttd.ts`
- [x] 2.2 Compute position from regime: BULL=1.0, BEAR=0.0, SIDEWAYS=0.0
- [x] 2.3 Simulate equity curve with fee friction from `fee_bps` parameter
- [x] 2.4 Calculate metrics: winRate, profitFactor, totalTrades, sharpeRatio, sharpeRatioMarket, annReturnStrat/annReturnMarket, annVolatilityStrat/annVolatilityMarket, maxDrawdown/maxDrawdownMarket, totalReturnStrat/totalReturnMarket, sortinoRatio, cagrStrat/cagrMarket
- [x] 2.5 Generate trade log with entry/exit dates, prices, hold days, exit reason, return percentage
- [x] 2.6 Return equity_curve as `[{ date, strat, market }]` for charting
- [x] 2.7 Handle empty data gracefully with zero metrics

## 3. Frontend: API Client Functions

- [x] 3.1 Add `fetchLttdLatest()`, `fetchLttdHistory()`, `fetchLttdChart()`, `fetchLttdRegime()` functions to `web/src/api/client.ts`
- [x] 3.2 Add `fetchLttdDiagnostics()`, `fetchLttdOnchain()`, `triggerLttdAction()` functions
- [x] 3.3 Add `fetchLttdBacktest()` function accepting `start`, `end`, `fee_bps` params
- [x] 3.4 Add TypeScript interfaces for new response types in `web/src/api/types.ts`
- [x] 3.5 Add `LttdRegimeRecord`, `LttdDiagnosticsRecord`, `LttdOnchainRecord`, `LttdBacktestResponse` types
- [x] 3.6 Apply CausalFilter verification to all new data fetchers

## 4. Frontend: 5-Pane Chart Expansion

- [x] 4.1 Add Final Score subplot between BTC Candlestick and HMM Probability panes using `LineSeries`
- [x] 4.2 Add Target Exposure subplot using `HistogramSeries` showing 0-100% exposure
- [x] 4.3 Add Regime State subplot using `LineSeries` with `LineType.WithSteps` mapping BULL→+1, BEAR→-1, SIDEWAYS→0
- [x] 4.4 Update `getPanelHeights()` to handle all 5 panes with maximize logic
- [x] 4.5 Update `chart-subplot-header` titles for new panes
- [x] 4.6 Preserve 85px Y-axis width lock and vertical crosshair sync across all 5 panes
- [x] 4.7 Update ResizeObserver to handle 5 panes
- [ ] 4.8 Verify mobile responsive layout and maximize behavior

## 5. Frontend: On-Chain Metrics Panel

- [x] 5.1 Extract `LttdOnchainPanel.tsx` component at `web/src/components/studios/LttdOnchainPanel.tsx`
- [x] 5.2 Create STH-MVRV `LineSeries` chart with 2.0 threshold line
- [x] 5.3 Create STH-NUPL `LineSeries` chart with 0.75 threshold line
- [x] 5.4 Add current value indicator below charts showing latest reading and alert status
- [x] 5.5 Integrate panel into `LttdLab.tsx` below the backtest controls
- [ ] 5.6 Make panel mobile-responsive with stacked layout

## 6. Frontend: Feature Diagnostics Panel *(partial — needs dedicated diagnostics data)*

- [ ] 6.1 Inline interactive indicator breakdown table in `LttdLab.tsx` *(existing table already in place)*
- [ ] 6.2 Add expandable rows for each indicator showing formula, description, interpretation, and historical performance *— needs data from /api/v1/lttd/diagnostics*
- [ ] 6.3 Add PCA Variance card with color-coded >85% indicator *— existing PCA card already in banner*
- [ ] 6.4 Add VIF warning card highlighting indicators with VIF > 10 *— existing VIF card already in banner*
- [ ] 6.5 Add Date slider for navigating historical diagnostic snapshots *— deferred for future pass*
- [ ] 6.6 Add On-chain Overrides tab with threshold cards *— deferred for future pass*

## 7. Frontend: Pipeline Control Center

- [x] 7.1 Extract `LttdControlCenter.tsx` component at `web/src/components/studios/LttdControlCenter.tsx`
- [x] 7.2 Create action buttons for sync_today, recover_10d, sync_gap, vif_audit, full_repopulation
- [x] 7.3 Implement execution log with timestamp, status (Running→Success/Failed), and output
- [x] 7.4 Add loading states and disabled buttons during action execution
- [x] 7.5 Add confirmation dialogs for destructive actions (reset_db, full_repopulation)
- [x] 7.6 Integrate panel into `LttdLab.tsx` between backtest controls and on-chain panel

## 8. Frontend: Regime Transition Audit Table

- [x] 8.1 Build regime transition detection logic iterating through sorted daily records
- [x] 8.2 Render transition table with Date, Previous Regime, New Regime, Score columns
- [x] 8.3 Add color-coded regime badges (green=BULL, red=BEAR, amber=SIDEWAYS)
- [x] 8.4 Handle empty state with "No regime transitions detected" message
- [x] 8.5 Integrate into LttdLab layout between Pipeline Control Center and Component Telemetry

## 9. Verification & Cleanup

- [ ] 9.1 Run `bun run build` in both `src/` and `web/` and fix any TypeScript errors
- [ ] 9.2 Verify all 5 chart panes render with correct data and crosshair sync
- [ ] 9.3 Verify on-chain metrics panel loads and displays chart data
- [ ] 9.4 Verify pipeline control center triggers actions and shows execution log
- [ ] 9.5 Verify regime transition audit table shows transitions correctly
- [ ] 9.6 Verify mobile responsiveness of all new panels
- [ ] 9.7 Run `python3 /home/ubuntu/projects/run_report_pipeline.py` to confirm no pipeline regression
- [ ] 9.8 Run `openspec validate --change lttd-missing-endpoints-and-metrics` to verify change completeness
