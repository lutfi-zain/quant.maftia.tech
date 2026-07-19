## 1. Backend SDCA Engine Fix

- [x] 1.1 Fix `sdcaMultiplier()` function in `src/lib/sdcaEngine.ts` — invert all threshold comparisons so positive composites map to high buy multipliers (+2.0x, +3.0x) and negative composites map to sell multipliers (-0.5x)
- [x] 1.2 Fix `detectPhase()` function in `src/lib/sdcaEngine.ts` — invert phase classification so positive composites classify as "deep_discount" / "value" and negative composites classify as "expansion" / "euphoria"
- [x] 1.3 Fix `determineAction()` function in `src/lib/sdcaEngine.ts` — invert entry/exit rules so "START_AGGRESSIVE_DCA" triggers on composite crossing above +1.0 and "SELL_ALL" triggers on composite crossing below -1.0
- [x] 1.4 Fix `regimeConfidence()` function in `src/lib/sdcaEngine.ts` — invert confidence logic so prolonged positive composite without price rise indicates low confidence
- [x] 1.5 Update comments and documentation in `src/lib/sdcaEngine.ts` to reflect correct sign convention

## 2. Frontend SDCA Engine Fix

- [x] 2.1 Fix `sdcaMultiplier()` function in `web/src/lib/sdcaEngine.ts` — mirror backend changes exactly
- [x] 2.2 Fix `detectPhase()` function in `web/src/lib/sdcaEngine.ts` — mirror backend changes exactly
- [x] 2.3 Fix `determineAction()` function in `web/src/lib/sdcaEngine.ts` — mirror backend changes exactly
- [x] 2.4 Fix `regimeConfidence()` function in `web/src/lib/sdcaEngine.ts` — mirror backend changes exactly
- [x] 2.5 Update comments and documentation in `web/src/lib/sdcaEngine.ts` to reflect correct sign convention

## 3. Historical Verification

- [x] 3.1 Verify Dec 25, 2018 (BTC $3,794, composite +1.9505) produces "Deep Discount" phase with 3.0x multiplier and "START_AGGRESSIVE_DCA" action
- [x] 3.2 Verify Dec 25, 2024 (BTC $98,844, composite ~ -0.5) produces "Expansion" phase with 0.5x multiplier and "REDUCE_POSITION" action
- [x] 3.3 Verify boundary conditions: composite +1.0 → 2.0x multiplier, composite -1.5 → -0.5x multiplier

## 4. Backtest Regeneration

- [x] 4.1 Run SDCA backtest on full historical dataset (2015-2026) with corrected sign convention
- [x] 4.2 Document new backtest metrics (Sharpe ratio, max drawdown, total return) and compare with old (incorrect) metrics
- [x] 4.3 Verify walk-forward validation produces reasonable results across multiple folds

## 5. Portfolio State Reset

- [x] 5.1 Add portfolio state backup mechanism to `web/src/lib/sdcaPortfolio.ts`
- [x] 5.2 Add one-time notification in `web/src/components/studios/SdcaPanel.tsx` informing users of sign convention fix and prompting portfolio reset
- [x] 5.3 Test portfolio reset functionality clears old positions and starts fresh

## 6. Spec Update

- [x] 6.1 Update `openspec/specs/sdca-strategy-engine/spec.md` with corrected sign convention (merge delta spec from this change)
- [x] 6.2 Verify all scenarios in the updated spec match the new implementation

## 7. Final Verification

- [x] 7.1 Run `python3 /home/ubuntu/projects/run_report_pipeline.py` to ensure no regressions in other systems
- [x] 7.2 Run LSP diagnostics on all modified TypeScript files to ensure no type errors
- [x] 7.3 Manual smoke test of Valuation Studio SDCA panel with corrected signals
- [x] 7.4 Commit all changes with message `fix: correct SDCA sign convention to match Valuation System`
