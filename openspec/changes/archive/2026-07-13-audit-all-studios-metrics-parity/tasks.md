## 1. Valuation Pillar Studio Audit & Alignment (`ValuationStudio.tsx`)

- [x] 1.1 Audit and align Valuation Studio position extraction (`valuation_composite >= 1.5` bubble override / `<= -1.0` discount entry) with canonical simulation hooks (`useStudioBacktest` or studio simulation logic) ensuring exact causal position shifting ($R_{\text{strat}, t} = R_{\text{market}, t} \times \text{Position}_{t-1}$)
- [x] 1.2 Verify all 11 performance metric cards ($E_N^{(365.25 / N)} - 1$ annualized return, $\sigma_{\text{daily}} \times \sqrt{365.25}$ volatility, Sharpe ratio, and peak-to-trough Max Drawdown) in `ValuationStudio.tsx` match backend python backtest outputs ($|a - b| < 10^{-6}$)
- [x] 1.3 Verify exact trade execution history log (`trades` array) inside `ValuationStudio.tsx` (`entryDate`, `exitDate`, `entryPrice`, `exitPrice`, `returnPct`, total trades, win rate, profit factor)
- [x] 1.4 Enforce `rightPriceScale: { minimumWidth: 85 }` and bidirectional real-time Vertical Crosshair Synchronization across all Valuation Studio chart subplots (`btcChart`, `metricChart`, `oscChart`, `eqChart`)

## 2. LTTD Lab Audit & Alignment (`LttdLab.tsx`)

- [x] 2.1 Audit and align LTTD Lab position extraction (`lttd_regime == BULL` vs `SIDEWAYS` zero-exposure lock) with canonical simulation hooks (`useStudioBacktest`) enforcing exact causal position shifting
- [x] 2.2 Verify all 11 performance metric summary cards in `LttdLab.tsx` match backend LTTD Python simulation outputs ($|a - b| < 10^{-6}$)
- [x] 2.3 Verify exact trade execution history log (`trades` table) inside `LttdLab.tsx` (`entryDate`, `exitDate`, `entryPrice`, `exitPrice`, `returnPct`)
- [x] 2.4 Enforce `rightPriceScale: { minimumWidth: 85 }` and bidirectional real-time Vertical Crosshair Synchronization across all LTTD Lab chart subplots (`btcChart`, `hmmChart`, `returnsChart`, `volChart`, `eqChart`)

## 3. MTTD Console Audit & Alignment (`MttdConsole.tsx`)

- [x] 3.1 Audit and align MTTD Console position extraction (`mttd_imo` multi-principle consensus filtered by Efficiency Ratio gate and Shannon Entropy gate) with canonical simulation hooks (`useStudioBacktest`) enforcing exact causal friction
- [x] 3.2 Verify all 11 performance metric summary cards in `MttdConsole.tsx` match backend MTTD Python simulation outputs ($|a - b| < 10^{-6}$)
- [x] 3.3 Verify exact trade execution history log (`trades` table) inside `MttdConsole.tsx` (`entryDate`, `exitDate`, `entryPrice`, `exitPrice`, `returnPct`)
- [x] 3.4 Enforce `rightPriceScale: { minimumWidth: 85 }` and bidirectional real-time Vertical Crosshair Synchronization across all MTTD Console chart subplots (`btcChart`, `imoChart`, `gatesChart`, `eqChart`)

## 4. Automated Multi-Studio Verification & System Acceptance

- [x] 4.1 Create or update Python automated verification scripts (`verify_valuation_studio_metrics_1to1.py`, `verify_lttd_studio_metrics_1to1.py`, `verify_mttd_studio_metrics_1to1.py`) to assert $1:1$ parity across all metric cards, trade counts, and equity curves
- [x] 4.2 Execute all studio verification scripts and confirm $100\%$ pass rates
- [x] 4.3 Execute `python3 /home/ubuntu/projects/run_report_pipeline.py` and confirm `verify_pipeline_api_parity.py` passes all $12,410+$ daily point assertions across all 4 defense systems cleanly
- [x] 4.4 Build the frontend (`cd web && npm run build`) and confirm zero TypeScript/Vite errors
