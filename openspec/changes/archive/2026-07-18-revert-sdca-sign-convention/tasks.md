## 1. SDCA Canonical Engine Restoration

- [x] 1.1 Restore the canonical SDCA sign convention in `src/lib/sdcaEngine.ts` so negative composite values map to DCA-out / overvaluation and positive composite values map to DCA-in / undervaluation.
- [x] 1.2 Mirror the restored engine logic into `web/src/lib/sdcaEngine.ts` and keep both copies byte-identical.
- [x] 1.3 Re-validate `sdcaMultiplier()`, `detectPhase()`, `determineAction()`, and `regimeConfidence()` against representative positive and negative composite samples.

## 2. Backend Backtest and API Alignment

- [x] 2.1 Update `src/lib/sdcaBacktest.ts` to consume the restored shared engine convention and preserve trade logging, fee handling, and threshold resolution.
- [x] 2.2 Update `src/api/routes/sdca.ts` so `/api/v1/sdca/signal` and `/api/v1/sdca/backtest` return signals and backtests using the restored convention.
- [x] 2.3 Reconcile `web/src/lib/studioBacktest.ts` with the canonical engine so the studio chart/backtest helper does not carry a stale local sign convention.

## 3. Frontend and Valuation UI Consistency

- [x] 3.1 Update `web/src/components/studios/SdcaPanel.tsx` threshold badges, action copy, and optimization labels so the panel matches the restored DCA-in / DCA-out convention.
- [x] 3.2 Update `web/src/components/studios/ValuationStudio.tsx` banner copy and accumulation/bubble labels so the visible chart text matches the canonical convention.
- [x] 3.3 Verify the SDCA chart Y-axis locking and crosshair synchronization remain unchanged while the label text is updated.

## 4. Verification, Data Pattern Check, and Release

- [x] 4.1 Run SDCA unit and portfolio tests (`bun test web/src/lib/__tests__/sdcaEngine.test.ts`, `bun test web/src/lib/__tests__/sdcaPortfolio.test.ts`) and confirm they pass with the restored convention.
- [x] 4.2 Run the verification script (`python3 verify_sdca_metrics_1to1.py`) and spot-check representative dates against the expected DCA-in / DCA-out direction.
- [x] 4.3 Re-run the full pipeline (`python3 /home/ubuntu/projects/run_report_pipeline.py`) and confirm no causal or data-sync regressions.
- [x] 4.4 Commit the change with a Conventional Commit message, then archive the change once validation is complete.
