## 1. Recalibrate SDCA Engine Triggers

- [x] 1.1 Update `engines/valuation/quant/sdca/engine.py` to use the optimized valuation thresholds: Buy DCA at `comp_t1 >= 1.0`, Buy All at `comp_t1 >= 1.8`, Sell DCA at `comp_t1 <= -0.5`, and Sell All at `comp_t1 <= -1.0` (with corresponding hysteresis exits of `0.8` and `-0.3`).

## 2. Verification & Testing

- [x] 2.1 Run unit tests in `engines/valuation/quant/tests/` to ensure FSM behavior is correct.
- [x] 2.2 Re-run the report pipeline `run_report_pipeline.py` to regenerate the backtests and verify overall CAGR and max drawdown metrics.
- [x] 2.3 Commit and archive the change.
