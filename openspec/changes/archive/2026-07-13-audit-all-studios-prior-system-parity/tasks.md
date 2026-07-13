## 1. Valuation Studio Parity & Feature Alignment (`ValuationStudio.tsx`)

- [x] 1.1 Verify and enforce causal $T-1$ position shifting (`useStudioBacktest` and studio simulation loops) where $Active\_Pos[t] = Pos[t-1]$ with `valuation_composite >= 1.50` bubble override and `<= -1.00` discount entry against `../quant-btc-valuation-system`
- [x] 1.2 Verify that all 11 performance metrics (`Win Rate`, `Profit Factor`, `Total Trades`, `Sharpe Ratio vs Market`, `Ann. Return vs Market`, `Ann. Volatility vs Market`, `Max Drawdown vs Market`, and `Total Return vs Market`) match `verify_valuation_studio_metrics_1to1.py` with $|a-b| < 10^{-6}$
- [x] 1.3 Verify exact trade execution history (`trades` array) inside `ValuationStudio.tsx` (`entryDate`, `exitDate`, `entryPrice`, `exitPrice`, `returnPct`) matches canonical trade log exactly
- [x] 1.4 Enforce `rightPriceScale: { minimumWidth: 85 }` and bidirectional real-time Vertical Crosshair Synchronization across all Valuation Studio chart subplots (`btcChart`, `metricChart`, `oscChart`, `eqChart`)

## 2. LTTD Lab Parity & Feature Alignment (`LttdLab.tsx`)

- [x] 2.1 Verify and enforce causal $T-1$ position shifting where position is $1$ only when `lttd_regime === "BULL"` AND `lttd_prob_sideways <= 0.60`, and $0$ otherwise (`SIDEWAYS` lock $> 0.60$) against `../quant-btc-lttd-system`
- [x] 2.2 Verify that all 11 performance metric cards match `verify_lttd_studio_metrics_1to1.py` with $|a-b| < 10^{-6}$
- [x] 2.3 Verify exact trade execution history (`trades` table) inside `LttdLab.tsx` matches canonical LTTD simulation outputs exactly 1:1
- [x] 2.4 Enforce `rightPriceScale: { minimumWidth: 85 }` and bidirectional real-time Vertical Crosshair Synchronization across all LTTD Lab chart subplots (`btcChart`, `hmmChart`, `returnsChart`, `volChart`, `eqChart`)

## 3. MTTD Console Parity & Feature Alignment (`MttdConsole.tsx`)

- [x] 3.1 Verify and enforce causal $T-1$ position shifting (`mttd_imo > 0.15` filtered by `mttd_er >= 0.20` and `mttd_entropy <= 2.30`) with robust column fallback chains (`mttd_er ?? mttd_er_ratio ?? 0` and `mttd_entropy ?? mttd_shannon_entropy ?? 0`) against `../quant-btc-mttd-system`
- [x] 3.2 Verify that all 11 performance metric summary cards match `verify_mttd_studio_metrics_1to1.py` exactly ($|a-b| < 10^{-6}$)
- [x] 3.3 Verify exact trade execution history (`trades` table) inside `MttdConsole.tsx` (`entryDate`, `exitDate`, `entryPrice`, `exitPrice`, `returnPct`)
- [x] 3.4 Enforce `rightPriceScale: { minimumWidth: 85 }` and bidirectional real-time Vertical Crosshair Synchronization across all MTTD Console chart subplots (`btcChart`, `imoChart`, `gatesChart`, `eqChart`)

## 4. Ichimoku Terminal Parity & Feature Alignment (`IchimokuTerminal.tsx`)

- [x] 4.1 Verify exact $1:1$ numerical parity across all 22 assertions in `verify_ichimoku_studio_metrics_1to1.py` (`Win Rate`, `Profit Factor`, `Total Trades`, `Sharpe Ratio`, `Ann. Return`, `Max Drawdown`, `Total Return`) across both default window (`2018-01-01` to `NOW()`) and historical span (`2011-01-01` to `NOW()`) against `../quant-lttd-ichimoku`
- [x] 4.2 Verify API-sourced leading momentum (`S_Future`) and lagging confirmation momentum (`S_Chikou`) visualization on S-Component chart pane with accurate metadata formulas (`ICHIMOKU_COMPONENTS_METADATA`) and signals
- [x] 4.3 Verify default rendering of reference vs strategy equity curves (`ichi_cum_strat` vs `ichi_cum_market`) on Pane 4 and interactive What-If overlay toggle behavior
- [x] 4.4 Enforce `rightPriceScale: { minimumWidth: 85 }` and bidirectional real-time Vertical Crosshair Synchronization across all 4 panes (`btcChart`, `oscChart`, `sCompChart`, `eqChart`)

## 5. Automated Multi-Studio Verification & System Acceptance

- [x] 5.1 Execute all 4 studio automated verification harnesses (`python3 verify_ichimoku_studio_metrics_1to1.py && python3 verify_valuation_studio_metrics_1to1.py && python3 verify_lttd_studio_metrics_1to1.py && python3 verify_mttd_studio_metrics_1to1.py`) and confirm $100\%$ pass rates across every metric card
- [x] 5.2 Execute `python3 /home/ubuntu/projects/run_report_pipeline.py` and confirm `verify_pipeline_api_parity.py` passes all $12,410+$ daily telemetry checks across all 4 systems cleanly
- [x] 5.3 Build the frontend (`cd web && npm run build`) and verify zero TypeScript/Vite build errors
