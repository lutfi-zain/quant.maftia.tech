## Why

There is a fundamental accounting divergence between the Python batch backtest engine (`scripts/calculate_sdca_backtest.py`) and the TypeScript API/Frontend engine (`src/lib/sdcaBacktest.ts` & `web/src/lib/sdcaBacktest.ts`):
1. **Capital Inflow Discrepancy**: The Python script injects `+$100/day` into cash (`sdca_cash += base_dca` every single day), growing total injected capital to ~$450k over 12 years. The TypeScript engine operates as a fixed lump-sum capital pool ($10,000) that rotates between BTC and cash.
2. **Metric Discrepancy**: Because the capital model is different, the metrics published in `latest_week_scores_report.md` (e.g. Sharpe 1.15, maxDrawdown) diverge from the metrics and equity curves calculated live in Valuation Studio via `POST /api/v1/sdca/backtest` (CAGR, totalReturn, Sharpe 1.20+).
3. **Double Source of Truth**: Two disparate codebases implement trade execution, fees, and equity calculation independently.

This change unifies the backtest accounting across Python and TypeScript to use an identical, institutional-grade fixed-pool rotation model (with optional configurable recurring contribution mode) so that batch reports and live terminal UI match 1-to-1.

## What Changes

- **Unify Python & TypeScript Accounting Models**:
  - Standardize `scripts/calculate_sdca_backtest.py` to use the canonical `src/lib/sdcaBacktest.ts` / `engines/valuation/quant/sdca/backtest.py` logic.
  - Implement consistent cash accounting (Fixed $10k initial pool with rotational allocations and explicit fee deduction).
- **Synchronize Output JSON & Report Metrics**:
  - Ensure `data/sdca_backtest.json` output format and field names (`metrics`, `equity_curve`, `trade_log`) are 100% identical between Python ETL script and TypeScript server endpoint.
  - Re-generate `latest_week_scores_report.md` using the unified backtest engine.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `sdca-backend-computation`: Standardize backtest accounting rules, fee deductions, and metrics calculations across Python and TypeScript engines.

## Impact & System Scope

- **Impacted Systems**: System 1 SDCA Engine (`engines/valuation/quant/sdca/backtest.py`, `scripts/calculate_sdca_backtest.py`), API Gateway backtest router (`src/api/routes/sdca.ts`), and Valuation Studio.
- **Zero Lookahead Bias**: Strictly enforced.
- **Non-Goals**:
  - No changes to indicator raw data or other studios.
