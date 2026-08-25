## 1. Engine Alignment & Refactoring

- [x] 1.1 Refactor `scripts/calculate_sdca_backtest.py` to use `engines/valuation/quant/sdca/backtest.py:compute_sdca_backtest()` directly
- [x] 1.2 Align field names in `data/sdca_backtest.json` to match `src/lib/sdcaBacktest.ts` schema exactly (`equity_curve`, `trade_log`, `metrics`)

## 2. Parity Verification

- [x] 2.1 Update and run `verify_sdca_metrics_1to1.py` to confirm Python vs TypeScript engine parity
- [x] 2.2 Re-run pipeline (`python3 run_report_pipeline.py`) to regenerate `latest_week_scores_report.md` with unified metrics
