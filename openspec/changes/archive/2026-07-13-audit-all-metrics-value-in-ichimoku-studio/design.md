## Context

`IchimokuTerminal.tsx` (`Ichimoku Studio`) displays 11 distinct performance comparison metrics across two holding modes (Ichimoku Strategy vs BTC Hold Market), 4 vertically synchronized chart subplots (`btcChart`, `imoChart`, `scompChart`, `eqChart`) with `85px` locked right Y-axis panes, and an interactive trade log (`trades`). While the backend (`run_report_pipeline.py`) now stores all 15 Ichimoku metrics inside `maftia_quant.db` (`unified_daily_analytics`), any discrepancy between frontend `studioBacktest.ts` metric calculation rules and the pure Python backtest engine (`quant-lttd-ichimoku/src/ichimoku_quant/backtest.py`) can cause reported performance numbers (Win Rate, Profit Factor, Annualized Return, Sharpe, Volatility, Max Drawdown) to diverge. To establish absolute 1:1 parity, every single metric formula, date boundary condition, and data payload must be systematically audited and locked down by automated tests.

## Goals / Non-Goals

**Goals:**
- Guarantee $1:1$ numerical identity between `studioBacktest.ts` performance metrics and Python `backtest.py` across the entire historical window (`2018-01-01` to `NOW()`).
- Verify and enforce that all 4 subplots (`btcChart`, `imoChart`, `scompChart`, `eqChart`) display exact values directly from `unified_daily_analytics` via API (`:8765`), maintaining real-time Vertical Crosshair Synchronization and `85px` right Y-axis width locks without synthetic line manipulation.
- Guarantee that every row in the frontend trade execution table (`trades`) matches the exact entry date, exit date, entry price, exit price, and return percentage produced by `run_backtest(df)` in `backtest.py`.
- Provide an automated test script (`verify_ichimoku_studio_metrics_1to1.py`) that runs alongside `verify_pipeline_api_parity.py` and asserts zero deviation ($|a - b| < 10^{-6}$) on all cards and tables.

**Non-Goals:**
- Changing Ehlers SuperSmoother IIR coefficients, period parameters (`20, 60, 120`), or bounded $\tanh$ formulas in `quant-lttd-ichimoku`.
- Modifying `quant-btc-valuation-system`, `quant-btc-lttd-system`, or `quant-btc-mttd-system` formulas.
- Re-introducing any deprecated modules such as `quant-technical-indicator-bank`.

## Decisions

### Decision 1: Canonical Metric Formula Alignment (`studioBacktest.ts` vs `backtest.py`)
- **Problem**: `studioBacktest.ts` previously computed annualized volatility using simple sample standard deviation or different trading day assumptions, while `backtest.py` uses daily log returns or exact simple returns scaled by $\sqrt{365.25}$ (`np.sqrt(365.25)`).
- **Solution**: Standardize `studioBacktest.ts` to use exact identical aggregation formulas:
  - Daily return at day $t$: $R_t = \frac{\text{Close}_t - \text{Close}_{t-1}}{\text{Close}_{t-1}}$
  - Strategy return at day $t$: $R_{\text{strat}, t} = R_t \times \text{Position}_{t-1}$ (causal $t-1$ lag)
  - Cumulative equity: $E_t = E_{t-1} \times (1 + R_{\text{strat}, t})$ starting from $1.0$ at date $t_0$
  - Annualized Return: $\text{AnnReturn} = E_N^{(365.25 / N)} - 1$
  - Annualized Volatility: $\text{AnnVol} = \sigma_{\text{daily}} \times \sqrt{365.25}$
  - Sharpe Ratio: $\frac{\text{AnnReturn}}{\text{AnnVol}}$ (assuming $0\%$ risk-free rate matching `backtest.py`)
  - Max Drawdown: $\max_{t} \left( \frac{\max_{0 \le \tau \le t} E_\tau - E_t}{\max_{0 \le \tau \le t} E_\tau} \right)$
- **Alternatives Considered**: Using 252 trading days. Rejected because Bitcoin trades 24/7/365 ($365.25$ average annual days).

### Decision 2: Trade Log Extraction & Aggregation Parity
- **Problem**: `backtest.py` records trades when `position[t] != position[t-1]`, logging `entry_date`, `exit_date`, `entry_price` (`close[t]`), and `exit_price` (`close[t_exit]`).
- **Solution**: Ensure `studioBacktest.ts` iterates through `filteredDailyData` exactly matching `backtest.py`'s position transition state machine, handling open positions at `NOW()` identically.

### Decision 3: Automated Verification Suite (`verify_ichimoku_studio_metrics_1to1.py`)
- **Problem**: Manual verification of 11 metric cards across multiple date slices is prone to oversight.
- **Solution**: Build a standalone Python harness `verify_ichimoku_studio_metrics_1to1.py` that queries `/api/v1/quant/daily`, runs `backtest.py` on the exact same date slice (`2018-01-01` to `NOW()`), and simulates `studioBacktest.ts` math in Python, asserting exact 1:1 equality for all 11 card values, all 4 chart series, and every trade log row.

## Risks / Trade-offs

- **[Risk] Float Precision Divergence between Python (`numpy`) and JS (`Number`)**: Floating-point arithmetic ($64$-bit IEEE 754) can vary in the last significant digit when accumulating compound equity curves over 3,111+ days.
  - **Mitigation**: Enforce a strict epsilon tolerance of $10^{-6}$ for all continuous metrics (Sharpe, Volatility, Returns) and exact equality ($0$ tolerance) for discrete counts (Total Trades, Win/Loss trade counts).
