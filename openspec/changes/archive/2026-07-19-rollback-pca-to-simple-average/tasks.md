## 1. Backend: Rollback PCA and Restore Simple Average

- [x] 1.1 Remove PCA integration from `run_report_pipeline.py`: delete the PCA import block and fallback PCA composite computation; restore the original `fetch_valuation_composite_data()` logic with SQL query filtering `aviv_nupl`, `williams_r`, and `fear_greed_cmc`.
- [x] 1.2 Delete `engines/valuation/quant/components/pca_compression.py` file.

## 2. Frontend: Clean Up Indicator Cards

- [x] 2.1 Remove `williams_r` and `fear_greed_cmc` entries from the `INDICATOR_METADATA` object in `ValuationStudio.tsx` so the component grid shows only the 14 active indicator cards.

## 3. Frontend: Add SDCA Phase Timeline

- [x] 3.1 Create a `SdcaPhaseTimeline` React component that renders a horizontal colored strip divided into segments by `sdca_phase` value, with colors: deep_discount=#10B981, value=#3B82F6, fair=#6B7280, expansion=#F59E0B, euphoria=#EF4444.
- [x] 3.2 Integrate `SdcaPhaseTimeline` into `ValuationStudio.tsx` below the equity curve subplot, passing `dailyData` mapped to phase-date pairs.

## 4. Verification & Deployment

- [x] 4.1 Run full pipeline `python3 /home/ubuntu/projects/run_report_pipeline.py` to verify rollback works without errors.
- [x] 4.2 Run audit `python3 scripts/audit_valuation.py` to confirm no flatline metrics and healthy range distribution.
- [x] 4.3 Build frontend `bun run build` (in web/) and run Playwright test to confirm no regressions.
- [x] 4.4 Commit and push with conventional commit message.
