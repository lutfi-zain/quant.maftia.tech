I now have all the evidence needed for a thorough review. Here is my structured finding.

---

## Review

### BLOCKER: Sign Convention Inversion in `sdcaEngine.ts` — 17 of 37 Tests Failing

The most critical finding is a **sign convention inversion** in `sdcaEngine.ts` (both `src/lib/sdcaEngine.ts` and `web/src/lib/sdcaEngine.ts`). The file header claims the convention was "corrected" but the correction is **backwards** relative to the authoritative source of truth.

**Evidence chain (4 independent sources agree on the correct convention):**

| Source | Convention | Evidence |
|---|---|---|
| Valuation System Doc §4.1 | `Composite ≥ +1.50` = **Sangat Overvalued**; `≤ -1.00` = **Sangat Undervalued** | `docs/01_quant_btc_valuation_system.md` lines describing critical thresholds |
| API Daily Route | `bubble_warning: composite >= 1.5`, `deep_discount_override: composite <= -1.0` | `src/api/routes/daily.ts:55-56` |
| Test File | `sdcaMultiplier(1.6)` → expects `-0.5` (sell); `sdcaMultiplier(-1.5)` → expects `3.0` (buy) | `web/src/lib/__tests__/sdcaEngine.test.ts:19,56` |
| studioBacktest.ts | `composite >= 1.5` → `-0.5` (sell); `composite <= -1.5` → `3.0` (buy) | `web/src/lib/studioBacktest.ts:463-472` |

**What `sdcaEngine.ts` currently does (WRONG):**

```typescript
// "CORRECTED" but actually inverted:
if (composite >= 1.5) return 3.0; // Buys 3x when market is OVERVALUED
if (composite > -1.5) return 0.0; // Pauses when market is UNDERVALUED
return -0.5; // Sells at cycle BOTTOM
```

**Confirmed by running tests:** `bun test sdcaEngine.test.ts` → **20 pass, 17 fail** (all failures are sign-convention related).

**Impact:** The SDCA engine has been **buying at cycle tops and selling at cycle bottoms** — the exact opposite of dollar-cost averaging intent. This fully explains:
- Why SDCA underperforms simple DCA by 1,658 percentage points
- Why max drawdown is 81.5% (heavy buying at euphoria peaks)
- Why grid search optimization yields minimal improvement (you cannot optimize a fundamentally inverted strategy)

---

### Proposal Review (`proposal.md`)

#### Correct
- **Data-driven problem statement**: Specific performance metrics (Sharpe 0.90, CAGR 46.1%, Max DD 81.5%) are cited with clear source attribution to the grid search audit.
- **Non-goals section**: Well-scoped. Properly excludes valuation system modification, other systems, and deprecated components. Respects the `quant-technical-indicator-bank` deprecation rule.
- **Impact matrix**: Risk levels are reasonable for the described changes.

#### Wrong
- **Root cause misdiagnosis (BLOCKER)**: The proposal attributes underperformance to "buy threshold triggers too aggressively" and "sell threshold exits too late." The actual root cause is the inverted sign convention in `sdcaEngine.ts`. Optimizing thresholds on an inverted engine will not fix the fundamental problem.
- **Misleading underperformance math**: "Underperforms by -1,658%" is an absolute percentage-point difference (10,698% − 12,356% = −1,658 pp). The relative underperformance is −13.4% `(10,698 − 12,356) / 12,356`. The current framing is misleading.
- **Self-contradictory**: States "opportunity to optimize buy/sell conditions to capture more alpha" but the grid search findings say "Strategy is robust but not optimizable — minimal improvement possible" (Sharpe 0.89–0.91 range). If optimization is marginal, the change does not justify its complexity.
- **Does not mention the 17 failing tests**: Task 6.1 references running existing tests but the proposal/design don't acknowledge that the tests are currently failing due to the sign convention mismatch.
- **Does not mention `studioBacktest.ts`**: The proposal lists `web/src/lib/sdcaEngine.ts` as a file to update but misses `web/src/lib/studioBacktest.ts` which has its own `sdcaMultiplierLocal()` function with the **correct** convention. Changing `sdcaEngine.ts` without updating `studioBacktest.ts` would create an inconsistency in the opposite direction.

---

### Design Review (`design.md`)

#### Correct
- **Structure**: Well-organized with goals/non-goals, decision-by-decision rationale, alternatives considered, and risk matrix.
- **Decision framing**: Each decision cites grid search data and names alternatives.
- **Migration plan**: Phased (Backend → API → Frontend) is logical. Rollback strategy mentions feature flags and configurable thresholds.
- **Open Questions section**: Good practice to surface unresolved items.

#### Wrong
- **Decision 3 (Adaptive Multiplier Scaling) — counterintuitive math**: The proposed adaptive scaling `3.0 * Math.min(1.0, composite / 2.0)` reduces the multiplier when composite is at +1.5 (which per correct convention is overvalued). Reducing buying when overvalued is correct, but reducing **selling** when overvalued (which is what happens under the inverted convention) is backwards. The adaptive scaling also means the max multiplier (3.0x) is only achievable at composite = 2.0, reducing buy power at +1.5 from 3.0x to 2.25x — this contradicts the intent of "aggressive accumulation during deep discounts."
- **Decision 4 (Regime Confidence) — unused in execution path**: The current `computeSdcaBacktest()` in `sdcaBacktest.ts:115` executes `const sdcaAmount = baseDcaAmount * multiplier` without multiplying by confidence. The `confidence` field is computed and returned in the signal but never applied to position sizing. The design proposes adding a multiplier but doesn't modify the backtest execution path — this is an incomplete specification.
- **Silent parameter changes**: The "Updated Entry Rules" and "Updated Exit Rules" tables introduce changes not covered by any decision:
  - Price percentile buy: `< 25%` → `< 30%` (not in any decision)
  - Price percentile sell: `> 80%` → `> 75%` (not in any decision)
  - Extended euphoria: `> 30 days` → `> 25 days` (not in any decision)
  
  These are undocumented scope additions.
- **Rollback strategy requires non-existent infrastructure**: "Feature flag for old vs new behavior" and "Keep old thresholds as configurable options" — the current codebase has no feature flag system and no configuration mechanism for thresholds (they are hardcoded constants). This would require additional implementation work not accounted for in the design or tasks.
- **Does not address `studioBacktest.ts`**: The design mentions updating `web/src/lib/sdcaEngine.ts` but omits `web/src/lib/studioBacktest.ts` which contains a separate `sdcaMultiplierLocal()` function. This file uses the correct convention and would need to stay aligned.

---

### Tasks Review (`tasks.md`)

- **Task 6.1** says "Run existing SDCA unit tests" — does not acknowledge that 17 of 37 tests are currently failing.
- **No task addresses fixing the sign convention** in `sdcaEngine.ts`, which is the actual prerequisite for any optimization to be meaningful.
- **Task 2.1–2.2** reference changing "default thresholds" in `sdcaBacktest.ts`, but that file doesn't have configurable threshold parameters — it delegates to `sdcaEngine.ts`'s `computeSdcaSignals()`.

---

### Risk Assessment

| Risk | Severity | Status |
|---|---|---|
| Sign convention inversion in `sdcaEngine.ts` causing inverted buy/sell behavior | **CRITICAL** | Present in code, not addressed by proposal |
| 17 of 37 unit tests failing (documenting correct convention) | **HIGH** | Pre-existing, not acknowledged |
| `studioBacktest.ts` has different convention than `sdcaEngine.ts` | **HIGH** | Pre-existing divergence, not addressed |
| Adaptive scaling reduces multiplier at overvalued extremes (inverted effect) | **MEDIUM** | Design flaw in Decision 3 |
| Regime confidence not applied in backtest execution path | **MEDIUM** | Incomplete specification in Decision 4 |
| Undocumented parameter changes (percentile thresholds, euphoria duration) | **LOW** | Silent scope addition |
| Rollback strategy requires non-existent feature flag infrastructure | **LOW** | Feasibility concern |

---

### Recommendations

1. **Fix the sign convention first**: Revert `sdcaEngine.ts` (both copies) to match the correct convention documented in the valuation system, confirmed by the API route, and tested by the test suite. This single fix will likely improve performance more than all proposed threshold changes combined.

2. **Re-run the grid search audit** after fixing the sign convention to establish a new baseline. The current performance numbers (Sharpe 0.90, CAGR 46.1%) were computed under the inverted convention and may change significantly.

3. **Align `studioBacktest.ts`**: After fixing `sdcaEngine.ts`, verify that `studioBacktest.ts`'s `sdcaMultiplierLocal()` remains consistent, or consolidate to a single multiplier function.

4. **Update the proposal**: Reframe the problem as fixing a sign convention bug, not threshold optimization. Remove the self-contradictory "opportunity to optimize" vs "not optimizable" tension.

5. **Resolve open questions before design sign-off**: Especially Question 2 (LTTD regime integration) which directly overlaps with Decision 4.

6. **Add silent parameter changes to design decisions**: The percentile and euphoria threshold changes need explicit justification and decision entries.

7. **Specify rollback infrastructure**: Either implement the feature flag mechanism or remove it from the rollback plan and specify a simpler `git revert` strategy.