I now have complete evidence. Here is my structured review.

---

## Review: OpenSpec Delta Specs for "optimize-sdca-buy-sell-conditions"

### 1. SIGN CONVENTION ASSESSMENT — BLOCKER

**The delta specs document and perpetuate an INVERTED sign convention.** This is the most critical finding.

**Correct convention (verified from 6 authoritative sources):**

| Source | Evidence | Convention |
|--------|----------|------------|
| `src/api/routes/daily.ts:55` | `bubble_warning: composite >= 1.5` | Positive = overvalued/bubble |
| `src/api/routes/daily.ts:56` | `deep_discount_override: composite <= -1.0` | Negative = undervalued/discount |
| `studioBacktest.ts:463` | `composite >= 1.5 → -0.5` (sell) | Positive = overvalued |
| `studioBacktest.ts:469` | `composite <= -1.5 → 3.0` (buy) | Negative = undervalued |
| `AGENTS.md:25` | `score >= +1.50 (bubble risk) or <= -1.00 (deep discount)` | Positive = bubble |
| Test file `sdcaEngine.test.ts:19` | `sdcaMultiplier(1.6) → expects -0.5` | Positive = sell |

**What the delta spec says (WRONG):**

```
- Positive composite (+1.0 to +2.0): undervaluation → BUY zone
- Negative composite (-1.0 to -2.0): overvaluation → SELL zone
```

**Test confirmation — 17 of 37 tests FAIL** against `sdcaEngine.ts` because the tests encode the correct convention while the implementation has the inverted one. Every failure is a sign-flip:

| Test expectation | sdcaEngine.ts returns | Root cause |
|------------------|-----------------------|------------|
| `sdcaMultiplier(1.6)` → `-0.5` (sell) | `3.0` (buy) | Positive mapped to buy |
| `sdcaMultiplier(-1.5)` → `3.0` (buy) | `-0.5` (sell) | Negative mapped to sell |
| `determineAction(-1.1, -0.9, 20, true, 0)` → `START_AGGRESSIVE_DCA` | `HOLD` | Entry rule at wrong threshold side |
| `determineAction(1.2, 0.9, 90, false, 0)` → `SELL_ALL` | `NORMAL_DCA` | Exit rule at wrong threshold side |
| Causal filtering: day 2 composite -1.5 → multiplier `3.0` | `-0.5` | Multiplier inverted |

**Root cause chain:** The archive fix (`openspec/changes/archive/2026-07-18-fix-sdca-sign-convention`) claimed positive = undervalued based on a misattribution ("Dec 2018 bottom → composite +1.9505"). This contradicts every system-level definition. The archive fix inverted `sdcaEngine.ts` from the correct convention to the wrong one. The delta specs were written after this inversion and document the now-buggy convention as "CORRECTED."

**Consequence for the delta specs:** Every requirement that references the sign convention is wrong:
- The multiplier table maps positive composites to buy multipliers (should be sell)
- Entry rules use positive thresholds for buying (should use negative)
- Exit rules use negative thresholds for selling (should use positive)
- Adaptive scaling applies to the wrong side (sell zone instead of buy zone)
- Confidence weighting examples use inverted sign values

---

### 2. COMPLETENESS ASSESSMENT

**Well-documented requirements (format correct):**
- ✅ SDCA Multiplier Function — WHEN/THEN scenarios present, adaptive scaling defined
- ✅ DCA Entry Rule — 3 conditions specified, 3 scenarios
- ✅ DCA Exit Rule — 3 exit conditions, 4 scenarios including sell amount clarification
- ✅ Regime Confidence Metric — Logic + weighting + 3 scenarios
- ✅ Adaptive Position Sizing (ADDED) — Formula + 3 scenarios
- ✅ Backend: Configuration, API endpoints, metrics, presets
- ✅ Studio: Display, metrics, trade log, equity curve, presets

**Missing from delta specs:**

1. **Cycle Phase Detection** — The live spec has a full `detectPhase` requirement with 5 phases. The delta modifies the multiplier zones which affects phase boundaries, but the delta spec does NOT include an updated `detectPhase` requirement. The phase table in the delta spec's multiplier table labels phases differently (e.g., "Deep Discount" at ≥ +1.5 vs the live spec's ≥ +1.0). This gap means the phase detection logic is ambiguous post-implementation.

2. **Causal Filtering** — Not modified (correct — should remain unchanged), but the delta spec doesn't explicitly carry forward this requirement. Acceptable since it's unmodified.

3. **Transaction Cost Modeling** — Not modified, correctly excluded.

4. **Walk-Forward Validation** — Not modified, correctly excluded.

---

### 3. CONSISTENCY ISSUES

**Issue 3a: Internal inconsistency within delta specs — Entry/Exit threshold naming**

The delta spec says:
- Entry: "composite crosses above +0.5 from below (entering value / undervaluation)"
- Exit: "composite crosses below -0.5 from above"

Under the spec's OWN stated convention (positive = undervalued), "crossing above +0.5" means entering deeper undervaluation → this IS an entry. And "crossing below -0.5" means entering overvaluation → this IS an exit. So the entry/exit logic is internally consistent WITH the wrong convention. However, this is globally inconsistent with the correct convention.

**Issue 3b: Backtest configuration thresholds are inverted vs correct convention**

Delta backend spec prescribes:
```
buy_threshold: +0.5, sell_threshold: -1.5
```

Under the correct convention:
- `buy_threshold: +0.5` would trigger buying when composite reaches +0.5 (overvalued) — WRONG
- `sell_threshold: -1.5` would trigger selling when composite reaches -1.5 (deep discount) — WRONG

The correct thresholds under the correct convention would be:
- `buy_threshold: -0.5` (buy when entering undervaluation)
- `sell_threshold: +1.5` (sell when entering overvaluation)

**Issue 3c: Parameter validation ranges are inverted**

Delta backend spec:
```
buy_threshold: [0.0, +2.0]
sell_threshold: [-2.0, 0.0]
```

Under the correct convention, buy thresholds should be negative and sell thresholds should be positive.

**Issue 3d: StudioBacktest.ts has its own circuit breaker convention inconsistency**

`studioBacktest.ts:232-233`:
```typescript
// Database convention: negative = overvalued (bubble)
} else if (prevRow && (prevRow.valuation_composite || 0) <= -1.5) {
    exitReason = "Circuit Breaker: Valuation Bubble";
```

The comment "Database convention: negative = overvalued (bubble)" is WRONG. The database/API convention (confirmed at `daily.ts:55`) is `composite >= 1.5 → bubble_warning`. So `composite <= -1.5` is deep discount, not bubble. This is a separate pre-existing bug in `studioBacktest.ts` unrelated to the delta specs, but worth noting since the delta specs reference `studioBacktest.ts` as an affected system.

**Issue 3e: Adaptive scaling formula applies to wrong zone**

The delta spec applies adaptive scaling to composites ≥ +1.5 (the SELL zone under correct convention):
```
multiplier = base_multiplier × min(1.0, composite / 2.0)
```

Adaptive scaling makes sense for the BUY side (preventing overconcentration at extreme undervaluation). Under the correct convention, this should apply to composites ≤ -1.5. The formula also has a sign issue: `composite / 2.0` for negative composites produces a negative scaling factor, which would flip a positive buy multiplier to negative.

**Issue 3f: Confidence weighting examples use inverted signs**

Delta spec:
```
LOW confidence: -0.5x becomes -0.25x (sell reduced by 50%)
```

Under the correct convention, -0.5x is the SELL multiplier at euphoria levels. Reducing sell intensity during low confidence may not be the desired behavior — typically low confidence would reduce BUY intensity, not sell intensity.

---

### 4. MISSING SCENARIOS

1. **No scenario for adaptive scaling on the correct side** — There should be scenarios testing adaptive buy scaling at negative composite extremes (e.g., composite -1.8 → scaled buy multiplier).

2. **No scenario for confidence weighting on BUY signals** — The delta only shows confidence reducing a sell multiplier and a buy multiplier at +0.8. Missing: confidence reducing a deep discount buy (e.g., composite -1.8, LOW confidence → 3.0x reduced to 1.5x).

3. **No scenario for entry when composite crosses below -0.5** (correct convention entry trigger) — The delta only has entry at +0.5 crossing.

4. **No scenario for exit when composite crosses above +0.5** (correct convention exit trigger) — The delta only has exit at -0.5 crossing.

5. **No boundary scenario for adaptive scaling** — What happens at exactly composite -1.5 (boundary between value and deep discount zones under correct convention)?

6. **No scenario testing interaction of confidence + adaptive scaling** — What's the final multiplier when both apply?

---

### 5. SUGGESTIONS FOR IMPROVEMENT

1. **Fix the sign convention throughout all three delta specs.** The multiplier table, entry/exit rules, phase labels, threshold values, adaptive scaling formula, and all scenario examples must be inverted to match the correct convention (positive = overvalued/sell, negative = undervalued/buy).

2. **Rewrite the adaptive scaling formula** for the correct side:
   ```typescript
   // Correct: adaptive scaling on BUY side (negative composites)
   if (composite <= -1.5) return 3.0 * Math.min(1.0, Math.abs(composite) / 2.0);
   if (composite <= -1.0) return 2.0 * Math.min(1.0, Math.abs(composite) / 1.5);
   ```

3. **Fix the backtest configuration defaults** to use correct sign:
   - `buy_threshold: -0.5` (was +0.5)
   - `sell_threshold: +1.5` (was -1.5)

4. **Fix parameter validation ranges:**
   - `buy_threshold: [-2.0, 0.0]` (was [0.0, +2.0])
   - `sell_threshold: [0.0, +2.0]` (was [-2.0, 0.0])

5. **Add the missing Cycle Phase Detection update** to the delta spec, since the adaptive scaling changes the effective multiplier at extreme composites.

6. **Note the `studioBacktest.ts` circuit breaker bug** as a follow-up task: `composite <= -1.5` should be `composite >= +1.5` for the valuation bubble circuit breaker.

---

### 6. ACCEPTANCE REPORT

```
## Review
- **Correct**: The delta specs follow WHEN/THEN format consistently. Scenario structure is clear and readable. The Adaptive Position Sizing requirement is well-defined with explicit formulas. Backend and Studio specs cover configuration, API endpoints, metrics, and display comprehensively. The "Non-Goals" section correctly excludes modification of Valuation, LTTD, MTTD, and Ichimoku systems.

- **Fixed**: None (review-only, no edits applied)

- **Blocker**: ALL three delta specs (`sdca-strategy-engine/spec.md`, `sdca-backend-computation/spec.md`, `sdca-studio-panel/spec.md`) document the INVERTED sign convention. Positive composite is labeled as "undervalued/buy" when it is actually "overvalued/sell." This affects: multiplier table, entry/exit rules, adaptive scaling formula, threshold defaults, parameter validation ranges, confidence examples, and every scenario. The specs are labeled "CORRECTED" but perpetuate the bug introduced by the archive fix. 17 of 37 tests fail against `sdcaEngine.ts`, confirming the implementation diverges from the correct convention.

- **Note**: `studioBacktest.ts:232-233` has a separate circuit breaker convention bug (`composite <= -1.5` labeled as "Valuation Bubble" when it should be `composite >= +1.5`). This is a pre-existing issue unrelated to the delta specs but affects backtest accuracy. The grid search audit scripts (`audit_sdca_grid_search_v2.py`) also use the inverted convention, meaning the optimization results cited in the proposal may not be valid under the correct convention.
```