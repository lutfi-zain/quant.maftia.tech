## 1. Metric Formula Audit & Alignment in `studioBacktest.ts`

- [x] 1.1 Audit and update daily strategy return calculation ($R_{\text{strat}, t} = R_t \times \text{Position}_{t-1}$) and cumulative equity accumulation to strictly match `backtest.py` causal friction
- [x] 1.2 Update `annReturnStrat` and `annReturnMarket` calculations in `studioBacktest.ts` to exact compound annualized formula ($E_N^{(365.25 / N)} - 1$) matching Python
- [x] 1.3 Update `annVolatilityStrat` and `annVolatilityMarket` calculations in `studioBacktest.ts` to exact $\sigma_{\text{daily}} \times \sqrt{365.25}$ matching `backtest.py`
- [x] 1.4 Verify `sharpeRatio` and `sharpeRatioMarket` formulas match Python exactly ($0\%$ risk-free rate assumption)
- [x] 1.5 Verify `maxDd` and `maxDdMarket` peak-to-trough calculations match `backtest.py` exactly ($|a - b| < 10^{-6}$)
- [x] 1.6 Verify `winRate`, `profitFactor`, and `totalTrades` exact integer count and ratio parity against `backtest.py`

## 2. Trade Execution Log & Subplot Series Parity in `IchimokuTerminal.tsx`

- [x] 2.1 Audit position transition state machine (`0 -> 1` and `1 -> 0`) in `studioBacktest.ts` to verify `trades` array (`entryDate`, `exitDate`, `entryPrice`, `exitPrice`, `returnPct`) mirrors `backtest.py` 1:1
- [x] 2.2 Audit `IchimokuTerminal.tsx` chart series populated data (`sTkSeries`, `sCloudSeries`, `sFutureSeries`, `sChikouSeries`, `imoSeries`, `entropySeries`, `erSeries`, `imoStdSeries`) to ensure zero rounding drift from `DailyAnalyticsPoint` fields
- [x] 2.3 Verify crosshair vertical synchronization across all 4 panes (`btcChart`, `imoChart`, `scompChart`, `eqChart`) and confirm exact $85\text{px}$ locked Y-axis width

## 3. Automated Verification & End-to-End Acceptance

- [x] 3.1 Create Python automated verification script `/home/ubuntu/projects/quant.maftia.tech/verify_ichimoku_studio_metrics_1to1.py` that queries `/api/v1/quant/daily`, runs `backtest.py`, simulates `studioBacktest.ts` formulas, and asserts $1:1$ identity ($|a - b| < 10^{-6}$) for all 11 performance cards across multiple date slices
- [x] 3.2 Execute `python3 /home/ubuntu/projects/verify_ichimoku_studio_metrics_1to1.py` and confirm $100\%$ pass rate
- [x] 3.3 Execute `python3 /home/ubuntu/projects/run_report_pipeline.py` and confirm `verify_pipeline_api_parity.py` passes all $12,410+$ assertions cleanly
- [x] 3.4 Build frontend (`cd web && npm run build`) and confirm zero TypeScript/Vite errors
