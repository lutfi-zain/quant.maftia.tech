## Context

The SDCA (Strategic Dollar Cost Averaging) engine is a core component of the Valuation Studio that maps `valuation_composite` scores to DCA allocation multipliers. The engine exists in two locations:

1. **Backend**: `src/lib/sdcaEngine.ts` — used by API routes and backtesting
2. **Frontend**: `web/src/lib/sdcaEngine.ts` — used by React components for real-time signal display

The Valuation System produces composite scores where:

- **Positive values (+1.0 to +2.0)**: Many indicators normalized to positive values, indicating the market is **undervalued** (cycle bottom zone)
- **Negative values (-1.0 to -2.0)**: Many indicators normalized to negative values, indicating the market is **overvalued** (cycle top zone)

This is because individual indicators like MVRV Z-Score normalize negative raw values (Market Cap < Realized Cap) to +2.0, signaling undervaluation.

**Current Bug**: The SDCA engine incorrectly assumes positive = overvalued, causing inverted signals.

## Goals / Non-Goals

**Goals:**

- Fix the sign convention in all SDCA engine functions to match the Valuation System's actual output
- Ensure the SDCA strategy correctly buys at bottoms (positive composite) and sells at tops (negative composite)
- Update the `sdca-strategy-engine` spec to document the correct sign convention
- Regenerate all backtest metrics with corrected logic
- Reset portfolio state to avoid carrying incorrect positions

**Non-Goals:**

- Modify the Valuation System composite calculation (it is correct)
- Modify LTTD, MTTD, or Ichimoku systems
- Change database schemas or data ingestion pipelines
- Modify the Valuation Studio UI layout or charting components
- Address `quant-technical-indicator-bank` (deprecated and removed)

## Decisions

### Decision 1: Invert All SDCA Engine Functions

**Choice**: Modify `sdcaMultiplier()`, `detectPhase()`, `determineAction()`, and `regimeConfidence()` to use correct sign convention.

**Rationale**: The bug affects the entire signal chain. Partial fixes would leave inconsistencies. A complete inversion of all functions ensures coherent behavior.

**Alternatives Considered**:

- *Negate the composite before passing to SDCA*: Rejected because it would hide the bug and make the code confusing for future developers.
- *Only fix the multiplier function*: Rejected because phase detection, entry/exit rules, and confidence logic all have the same sign convention bug.

### Decision 2: Maintain Backward Compatibility for Portfolio State

**Choice**: Add a portfolio state reset mechanism rather than trying to migrate existing positions.

**Rationale**: Existing portfolio states are based on incorrect signals. Attempting to "fix" them would be complex and error-prone. A clean reset with a backup of old state is safer.

**Alternatives Considered**:

- *Auto-migrate portfolio state*: Rejected because the old signals were wrong, so any migration logic would also be wrong.
- *Version the portfolio state schema*: Rejected as over-engineering for a bug fix.

### Decision 3: Single Codebase Update with Both Copies

**Choice**: Update both `src/lib/sdcaEngine.ts` and `web/src/lib/sdcaEngine.ts` simultaneously.

**Rationale**: Both copies must have identical logic to ensure backend backtests and frontend real-time signals match. The files should be kept in sync.

**Alternatives Considered**:

- *Consolidate to single source*: Good long-term goal but out of scope for this bug fix. Would require build system changes.

### Decision 4: Verification via Historical Spot Checks

**Choice**: Verify the fix by checking known historical dates (Dec 2018 bottom, Dec 2024 bull market) produce correct signals.

**Rationale**: These dates have clear ground truth — Dec 2018 was a cycle bottom (should show BUY), Dec 2024 was a bull market (should show SELL).

**Alternatives Considered**:

- *Full backtest comparison*: Will be done but as a separate validation step, not part of the core fix.

## Risks / Trade-offs

**Risk 1**: Existing backtest results become invalid
→ **Mitigation**: Document that all previous SDCA performance metrics should be disregarded. Re-run backtests after fix.

**Risk 2**: Portfolio state from old signals may have incorrect positions
→ **Mitigation**: Add portfolio reset button and document that users should reset their SDCA portfolio after the fix.

**Risk 3**: Users accustomed to old (wrong) behavior may be confused
→ **Mitigation**: Add clear changelog entry and display a one-time notification about the sign convention fix.

**Risk 4**: Both codebase copies may drift out of sync in the future
→ **Mitigation**: Add a comment at the top of both files noting they must be kept in sync. Consider future consolidation to single source.

## Migration Plan

1. **Pre-deployment**: Backup any existing portfolio state from localStorage
2. **Deploy**: Update both SDCA engine files with corrected sign convention
3. **Post-deployment**:
   - Display notification about sign convention fix
   - Prompt users to reset their SDCA portfolio
   - Re-run backtests and update performance metrics
4. **Rollback**: If issues arise, revert both files to previous version and restore portfolio state from backup

## Open Questions

1. Should we add a unit test suite specifically for sign convention validation to prevent future regressions?
2. Should we consolidate the two SDCA engine copies into a shared module as a follow-up task?
