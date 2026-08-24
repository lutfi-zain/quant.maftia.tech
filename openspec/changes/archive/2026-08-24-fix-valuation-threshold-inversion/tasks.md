## 1. Frontend Chart & UI Inversion Fixes

- [x] 1.1 Invert and correct valuation composite price lines in `web/src/components/studios/ValuationStudio.tsx` to canonical convention (+2.00 Extreme Undervalued `#22C55E`, +1.00 Discount / Accumulation `#4ADE80`, 0.00 Neutral `#64748B`, -1.50 Bubble Risk `#F87171`, -2.00 Extreme Overvalued `#EF4444`)
- [x] 1.2 Update reference price lines (+1.00 Discount `#22C55E`, -1.50 Bubble `#EF4444`) and subplot label in `web/src/components/charts/MultiPaneChart.tsx`
- [x] 1.3 Correct piecewise linear threshold score descriptions in `web/src/components/studios/ConfigurationPanel.tsx` (`t_minus_2` -> -2.0, `t_minus_1` -> -1.0, `t_plus_1` -> +1.0, `t_plus_2` -> +2.0)

## 2. Architectural Documentation & Repository Rules Synchronization

- [x] 2.1 Synchronize ValuationComposite circuit breaker threshold descriptions in `AGENTS.md` (`<= -1.50` bubble risk, `>= +1.00` deep discount)
- [x] 2.2 Synchronize circuit breaker threshold text in `UNIFIED_SYSTEM_ARCHITECTURE.md`, `docs/architecture/00_end_to_end.md`, and `docs/architecture/01_valuation_system.md`

## 3. Verification & Test Suite

- [x] 3.1 Run frontend tests (`bun test`) to verify SDCA engine, studio backtesting, and chart helpers pass without error
- [x] 3.2 Run frontend typecheck and build (`bun run build` in `web/`) to ensure clean bundle compilation
- [x] 3.3 Run pipeline verification (`python3 run_report_pipeline.py`) to confirm zero cross-system regressions
