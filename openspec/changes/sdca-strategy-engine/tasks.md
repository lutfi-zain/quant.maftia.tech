## 1. SDCA Signal Engine (TypeScript)

- [x] 1.1 Create `web/src/lib/sdcaEngine.ts` with SDCA multiplier function (piecewise linear mapping with CORRECTED sign convention: negative composite = buy, positive composite = sell)
- [x] 1.2 Implement cycle phase detection (Deep Discount, Value, Fair, Expansion, Euphoria) based on composite + percentile + trend
- [x] 1.3 Implement DCA entry rule (composite crosses below -1.0, price < 25th percentile, trend positive)
- [x] 1.4 Implement DCA exit rule (composite crosses above +0.5, price > 80th percentile, extended euphoria)
- [x] 1.5 Add causal filtering enforcement (t-1 data only for day t signals)
- [x] 1.6 Implement regime confidence metric (HIGH/LOW based on composite consistency)
- [x] 1.7 Create SDCA signal types (`SdcaSignal`, `SdcaPhase`, `SdcaAction`, `RegimeConfidence`)
- [x] 1.8 Write unit tests for multiplier function edge cases and phase detection

## 2. Portfolio Tracker (TypeScript)

- [x] 2.1 Create `web/src/lib/sdcaPortfolio.ts` with portfolio state management
- [x] 2.2 Implement DCA buy execution (multiplier-based amount calculation, balance updates, fee deduction)
- [x] 2.3 Implement DCA sell execution (USD-amount-based selling, NOT percentage of holdings)
- [x] 2.4 Implement portfolio metrics calculation (unrealized P&L, cost basis, portfolio value, total fees paid)
- [x] 2.5 Implement transaction log with all required fields (including feeUsd, proceedsUsd)
- [x] 2.6 Add localStorage persistence for portfolio state
- [x] 2.7 Add transaction log CSV export functionality
- [x] 2.8 Write unit tests for buy/sell execution and metrics calculation

## 3. SDCA Panel Component (React)

- [x] 3.1 Create `web/src/components/studios/SdcaPanel.tsx` with collapsible panel layout
- [x] 3.2 Implement multiplier gauge display (visual scale -0.5x to +3.0x with color coding)
- [x] 3.3 Implement phase indicator badge (Deep Discount → Euphoria with icons)
- [x] 3.4 Implement portfolio metrics grid (position, cost basis, P&L, value, cash, total fees)
- [x] 3.5 Implement transaction log table (scrollable, last 20 entries)
- [x] 3.6 Add responsive design (5-col desktop, 2-col mobile)
- [x] 3.7 Add localStorage persistence for panel collapsed/expanded state

## 4. DCA History Chart (Lightweight Charts)

- [x] 4.1 Create DCA history chart component with BTC price candlestick
- [x] 4.2 Add multiplier area series on secondary Y-axis
- [x] 4.3 Add buy/sell markers on price chart (green arrows down, red arrows up)
- [x] 4.4 Implement 85px Y-axis lock on all subplots
- [x] 4.5 Implement vertical crosshair sync with main chart
- [x] 4.6 Handle responsive sizing (stack vertically on mobile)

## 5. Valuation Studio Integration

- [x] 5.1 Add SDCA panel to ValuationStudio.tsx (below main chart area)
- [x] 5.2 Wire SDCA engine to dailyData from useTerminal
- [x] 5.3 Wire SDCA signals to portfolio tracker
- [x] 5.4 Add SDCA state display in summary row (multiplier, phase, action, regime confidence)
- [x] 5.5 Add SDCA-specific backtest mode to useStudioBacktest
- [x] 5.6 Verify 85px Y-axis lock on SDCA chart
- [x] 5.7 Test mobile responsive layout

## 6. Backtest Extension

- [x] 6.1 Extend `web/src/lib/studioBacktest.ts` with SDCA multiplier-based position sizing
- [x] 6.2 Add SDCA vs Simple DCA vs Buy & Hold comparison metrics
- [x] 6.3 Implement SDCA-specific Sharpe ratio calculation (fee-adjusted and fee-free)
- [x] 6.4 Add SDCA backtest results to Valuation Studio metrics panel
- [x] 6.5 Verify t-1 causal enforcement in SDCA backtest mode
- [x] 6.6 Implement walk-forward validation with configurable train/test split
- [x] 6.7 Add sensitivity analysis for ±20% threshold variation

## 7. Testing & Validation

- [x] 7.1 Run `python3 /home/ubuntu/projects/run_report_pipeline.py` to verify data pipeline
- [x] 7.2 Verify SDCA engine produces correct signals for historical data (2015-2026) with CORRECTED sign convention
- [x] 7.3 Verify portfolio tracker handles edge cases (insufficient cash, full sell, zero balance, fee calculation)
- [x] 7.4 Verify SDCA panel renders correctly on desktop and mobile
- [x] 7.5 Verify DCA history chart syncs with main chart crosshair
- [x] 7.6 Run `lens_diagnostics mode=full` to verify no TypeScript errors
- [x] 7.7 Verify all commits follow Conventional Commits (`feat:`, `fix:`, `quant:`, `refactor:`, `test:`)
- [x] 7.8 Run walk-forward validation and verify out-of-sample performance is reported
