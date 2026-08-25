## 1. Python Engine Updates

- [x] 1.1 Implement proportional cash deployment and `DCA_OUT` position trimming in `engines/valuation/quant/sdca/backtest.py`

## 2. TypeScript Engine Updates

- [x] 2.1 Replicate identical proportional cash deployment and `DCA_OUT` position trimming in `src/lib/sdcaBacktest.ts` and `web/src/lib/sdcaBacktest.ts`

## 3. Verification & Pipeline Sync

- [x] 3.1 Run `cd web && bun test src` and `cd web && bun run build`
- [x] 3.2 Run parity check (`python3 verify_sdca_metrics_1to1.py`) and full pipeline (`python3 run_report_pipeline.py`)
