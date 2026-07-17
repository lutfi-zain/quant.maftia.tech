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

- [ ] 2.1 Create `web/src/lib/sdcaPortfolio.ts` with portfolio state management
- [ ] 2.2 Implement DCA buy execution (multiplier-based amount calculation, balance updates, fee deduction)
- [ ] 2.3 Implement DCA sell execution (USD-amount-based selling, NOT percentage of holdings)
- [ ] 2.4 Implement portfolio metrics calculation (unrealized P&L, cost basis, portfolio value, total fees paid)
- [ ] 2.5 Implement transaction log with all required fields (including feeUsd, proceedsUsd)
- [ ] 2.6 Add localStorage persistence for portfolio state
- [ ] 2.7 Add transaction log CSV export functionality
- [ ] 2.8 Write unit tests for buy/sell execution and metrics calculation

## 3. SDCA Panel Component (React)

- [ ] 3.1 Create `web/src/components/studios/SdcaPanel.tsx` with collapsible panel layout
- [ ] 3.2 Implement multiplier gauge display (visual scale -0.5x to +3.0x with color coding)
- [ ] 3.3 Implement phase indicator badge (Deep Discount → Euphoria with icons)
- [ ] 3.4 Implement portfolio metrics grid (position, cost basis, P&L, value, cash, total fees)
- [ ] 3.5 Implement transaction log table (scrollable, last 20 entries)
- [ ] 3.6 Add responsive design (5-col desktop, 2-col mobile)
- [ ] 3.7 Add localStorage persistence for panel collapsed/expanded state

## 4. DCA History Chart (Lightweight Charts)

- [ ] 4.1 Create DCA history chart component with BTC price candlestick
- [ ] 4.2 Add multiplier area series on secondary Y-axis
- [ ] 4.3 Add buy/sell markers on price chart (green arrows down, red arrows up)
- [ ] 4.4 Implement 85px Y-axis lock on all subplots
- [ ] 4.5 Implement vertical crosshair sync with main chart
- [ ] 4.6 Handle responsive sizing (stack vertically on mobile)

## 5. Valuation Studio Integration

- [ ] 5.1 Add SDCA panel to ValuationStudio.tsx (below main chart area)
- [ ] 5.2 Wire SDCA engine to dailyData from useTerminal
- [ ] 5.3 Wire SDCA signals to portfolio tracker
- [ ] 5.4 Add SDCA state display in summary row (multiplier, phase, action, regime confidence)
- [ ] 5.5 Add SDCA-specific backtest mode to useStudioBacktest
- [ ] 5.6 Verify 85px Y-axis lock on SDCA chart
- [ ] 5.7 Test mobile responsive layout

## 6. Backtest Extension

- [ ] 6.1 Extend `web/src/lib/studioBacktest.ts` with SDCA multiplier-based position sizing
- [ ] 6.2 Add SDCA vs Simple DCA vs Buy & Hold comparison metrics
- [ ] 6.3 Implement SDCA-specific Sharpe ratio calculation (fee-adjusted and fee-free)
- [ ] 6.4 Add SDCA backtest results to Valuation Studio metrics panel
- [ ] 6.5 Verify t-1 causal enforcement in SDCA backtest mode
- [ ] 6.6 Implement walk-forward validation with configurable train/test split
- [ ] 6.7 Add sensitivity analysis for ±20% threshold variation

## 7. Testing & Validation

- [ ] 7.1 Run `python3 /home/ubuntu/projects/run_report_pipeline.py` to verify data pipeline
- [ ] 7.2 Verify SDCA engine produces correct signals for historical data (2015-2026) with CORRECTED sign convention
- [ ] 7.3 Verify portfolio tracker handles edge cases (insufficient cash, full sell, zero balance, fee calculation)
- [ ] 7.4 Verify SDCA panel renders correctly on desktop and mobile
- [ ] 7.5 Verify DCA history chart syncs with main chart crosshair
- [ ] 7.6 Run `lens_diagnostics mode=full` to verify no TypeScript errors
- [ ] 7.7 Verify all commits follow Conventional Commits (`feat:`, `fix:`, `quant:`, `refactor:`, `test:`)
- [ ] 7.8 Run walk-forward validation and verify out-of-sample performance is reported
