## 1. Phase A: Fix Sign Convention (Bug Fix — CRITICAL)

### 1A. Fix `src/lib/sdcaEngine.ts`

- [x] 1A.1 Fix `sdcaMultiplier()` function — revert to correct convention (positive = overvalued/sell, negative = undervalued/buy)
- [x] 1A.2 Fix `detectPhase()` function — invert all composite comparisons (Deep Discount ≤ -1.0, Euphoria ≥ +1.0)
- [x] 1A.3 Fix `determineAction()` function — correct entry/exit thresholds (entry at -1.0, exit at +0.5)
- [x] 1A.4 Fix `regimeConfidence()` function — correct overvaluation check (composite > +1.0 for extended period)
- [x] 1A.5 Update comments and documentation in file header to reflect correct convention

### 1B. Fix `web/src/lib/sdcaEngine.ts`

- [x] 1B.1 Mirror all fixes from `src/lib/sdcaEngine.ts` to `web/src/lib/sdcaEngine.ts`
- [x] 1B.2 Verify both files are byte-identical

### 1C. Fix Spec Documentation

- [x] 1C.1 Update `openspec/specs/sdca-strategy-engine/spec.md` with correct sign convention
- [x] 1C.2 Verify multiplier table matches corrected implementation
- [x] 1C.3 Verify entry/exit rules match corrected implementation

### 1D. Verify Tests Pass

- [x] 1D.1 Run test suite: `bun test sdcaEngine.test.ts`
- [x] 1D.2 Verify all 37 tests pass (currently 17 fail)
- [x] 1D.3 Run portfolio tests: `bun test sdcaPortfolio.test.ts`
- [x] 1D.4 Verify all portfolio tests pass

### 1E. Verify Backend Computation

- [x] 1E.1 Verify `src/lib/sdcaBacktest.ts` produces correct results after fix
- [x] 1E.2 Run verification script: `python3 verify_sdca_metrics_1to1.py`
- [x] 1E.3 Verify API endpoints return correct signals

### 1F. Align `studioBacktest.ts`

- [x] 1F.1 Verify `web/src/lib/studioBacktest.ts:sdcaMultiplierLocal()` matches corrected `sdcaEngine.ts`
- [x] 1F.2 Decide: merge into single source of truth OR keep in sync
- [x] 1F.3 If merging: update imports and remove duplicate function

### 1G. Commit Phase A

- [x] 1G.1 Stage all changes
- [x] 1G.2 Commit with message: `fix: correct SDCA sign convention (positive=overvalued, negative=undervalued)`
- [x] 1G.3 Verify commit passes CI checks

---

## 2. Phase B: Optimize Thresholds (Feature Work)

### 2A. Re-baseline Metrics

- [x] 2A.1 Run grid search audit with corrected convention: `python3 audit_sdca_grid_search_v2.py`
- [x] 2A.2 Document baseline metrics (Sharpe, CAGR, MaxDD, Win Rate)
- [x] 2A.3 Compare to previous (inverted) metrics

### 2B. Optimize `src/lib/sdcaEngine.ts`

- [x] 2B.1 Adjust buy threshold from -1.0 to -0.5 (earlier accumulation)
- [x] 2B.2 Adjust sell threshold from +1.0 to +1.5 (earlier profit-taking)
- [x] 2B.3 Add adaptive scaling for deep discount zone (composites ≤ -1.5)
- [x] 2B.4 Add regime confidence weighting to multiplier
- [x] 2B.5 Adjust price percentile thresholds (buy < 30%, sell > 75%)
- [x] 2B.6 Reduce extended euphoria threshold from 30 to 25 days

### 2C. Update `src/lib/sdcaBacktest.ts`

- [x] 2C.1 Update default `buy_threshold` from -1.0 to -0.5
- [x] 2C.2 Update default `sell_threshold` from +1.0 to +1.5
- [x] 2C.3 Add parameter validation for thresholds (buy: -2.0 to 0.0, sell: 0.0 to +2.0)
- [x] 2C.4 Ensure trade log captures profit percentage for SELL actions

### 2D. Update `src/api/routes/sdca.ts`

- [x] 2D.1 Add parameter presets (conservative, moderate, aggressive)
- [x] 2D.2 Set default preset to "conservative" (optimized parameters)
- [x] 2D.3 Add preset validation and parameter override logic
- [x] 2D.4 Ensure backward compatibility with existing API consumers

### 2E. Update Frontend

- [x] 2E.1 Mirror backend changes to `web/src/lib/sdcaEngine.ts`
- [x] 2E.2 Update `web/src/components/studios/SdcaPanel.tsx` — add parameter preset dropdown
- [x] 2E.3 Update `web/src/components/studios/SdcaPanel.tsx` — display current buy/sell thresholds with optimization badge
- [x] 2E.4 Update `web/src/components/studios/SdcaPanel.tsx` — add configuration update notification
- [x] 2E.5 Update `web/src/components/studios/SdcaPanel.tsx` — display alpha comparison (SDCA vs Simple DCA)
- [x] 2E.6 Verify equity curve Y-axis locked to 85px
- [x] 2E.7 Verify crosshair synchronization across subplots

### 2F. Testing & Validation

- [x] 2F.1 Run SDCA unit tests: `bun test sdcaEngine.test.ts`
- [x] 2F.2 Run SDCA portfolio tests: `bun test sdcaPortfolio.test.ts`
- [x] 2F.3 Run verification script: `python3 verify_sdca_metrics_1to1.py`
- [x] 2F.4 Run grid search audit: `python3 audit_sdca_grid_search_v2.py`
- [x] 2F.5 Verify walk-forward validation shows no overfitting (OOS Sharpe ≥ 0.85)
- [x] 2F.6 Verify max drawdown reduced from baseline

### 2G. Pipeline Verification

- [x] 2G.1 Run full pipeline: `python3 /home/ubuntu/projects/run_report_pipeline.py`
- [x] 2G.2 Verify `unified_daily_analytics` table updated with latest data
- [x] 2G.3 Verify SDCA signals computed correctly for recent dates
- [x] 2G.4 Verify no lookahead bias introduced (t-1 causal filtering preserved)

### 2H. Documentation & Commits

- [x] 2H.1 Update SDCA Strategy Engine spec in `openspec/specs/sdca-strategy-engine/spec.md`
- [x] 2H.2 Update SDCA Backend Computation spec in `openspec/specs/sdca-backend-computation/spec.md`
- [x] 2H.3 Update SDCA Studio Panel spec in `openspec/specs/sdca-studio-panel/spec.md`
- [x] 2H.4 Create commit with conventional format: `feat: optimize SDCA thresholds and add adaptive positioning`
- [x] 2H.5 Archive change: `openspec archive change "optimize-sdca-buy-sell-conditions"`

---

## 3. Acceptance Criteria

### Phase A Acceptance

- [x] 3A.1 All 37 SDCA tests pass (0 failures)
- [x] 3A.2 `sdcaMultiplier(1.6)` returns `-0.5` (sell at overvaluation)
- [x] 3A.3 `sdcaMultiplier(-1.5)` returns `3.0` (buy at undervaluation)
- [x] 3A.4 `determineAction(-1.1, -0.9, 20, true, 0)` returns `START_AGGRESSIVE_DCA`
- [x] 3A.5 `determineAction(1.2, 0.9, 90, false, 0)` returns `SELL_ALL`
- [x] 3A.6 Spec documentation matches corrected implementation

### Phase B Acceptance

- [x] 3B.1 Sharpe ratio ≥ baseline (re-baselined after Phase A)
- [x] 3B.2 Max drawdown < baseline (re-baselined after Phase A)
- [x] 3B.3 Win rate > 95%
- [x] 3B.4 Walk-forward OOS Sharpe ≥ 0.85
- [x] 3B.5 No regression in existing SDCA unit tests
- [x] 3B.6 API backward compatibility maintained
- [x] 3B.7 Parameter presets work correctly
- [x] 3B.8 Adaptive scaling applies correctly
- [x] 3B.9 Regime confidence weighting applies correctly
