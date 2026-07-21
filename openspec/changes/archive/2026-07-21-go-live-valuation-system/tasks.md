## 1. Core Logic Changes in Valuation Studio

- [x] 1.1 Implement causal, expanding window percentile rescaling in `run_report_pipeline.py` instead of the global `audit_composite_params` query lookup, ensuring zero lookahead bias.
- [x] 1.2 Implement Pearson indicator cluster consolidation in `run_report_pipeline.py` and `engines/valuation/quant/audit/composite.py` to prevent duplicate weight attribution to highly correlated features ($|r| > 0.85$).

## 2. SDCA Allocation FSM Stabilization

- [x] 2.1 Update `engines/valuation/quant/sdca/engine.py` to implement a hysteresis buffer of $\pm 0.2$ on FSM transitions from `SELL_DCA` and `BUY_DCA` to prevent signal whiplash.
- [x] 2.2 Re-run and verify the SDCA backtests using `sdca/backtest.py` to ensure transactional transaction costs are reduced and overall metrics remain stable.

## 3. Verification & Testing

- [x] 3.1 Execute unit tests inside `engines/valuation/quant/tests/` to verify that modifications do not break basic system calculations.
- [x] 3.2 Execute the master synchronization and report generation script `python3 /home/ubuntu/projects/run_report_pipeline.py` as the final pipeline verification.
- [x] 3.3 Verify that the calculated valuation composite on 2025-10-06 registers as overvalued ($\le -1.0$) and that transactional whiplash is reduced.
- [x] 3.4 Commit changes using Conventional Commits convention (e.g. `quant: implement causal rescaling, indicator clustering, and SDCA hysteresis`).
