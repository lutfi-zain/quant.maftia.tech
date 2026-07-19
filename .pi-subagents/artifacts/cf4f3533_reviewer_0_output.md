Now I have all the evidence needed for a comprehensive review. Here is my structured analysis:

---

## Review: Tasks for "optimize-sdca-buy-sell-conditions"

### Executive Summary

**The tasks.md is fundamentally broken.** It proposes threshold adjustments to a function whose sign convention is inverted relative to the valuation system, the API, the tests, and the working `studioBacktest.ts` implementation. None of the tasks address this critical bug. Executing the plan as-is would produce nonsensical results — further inverting already-inverted logic, and causing 17 existing tests to fail (they already do).

---

### 1. Correctness Analysis — The Sign Convention Contradiction

I verified the sign convention across all sources:

| Source | Composite +1.5 | Composite -1.5 | Convention |
|--------|----------------|----------------|------------|
| **API** `routes/daily.ts:55` | `bubble_warning: >= 1.5` → Overvalued | `deep_discount_override: <= -1.0` → Undervalued | **Positive = Sell, Negative = Buy** |
| **Test** `sdcaEngine.test.ts:66` | `sdcaMultiplier(1.6)` → expects `-0.5` | `sdcaMultiplier(-1.5)` → expects `3.0` | **Positive = Sell, Negative = Buy** |
| **studioBacktest.ts:462-469** | `sdcaMultiplierLocal(1.5)` → `-0.5` | `sdcaMultiplierLocal(-1.5)` → `3.0` | **Positive = Sell, Negative = Buy** |
| **src/lib/sdcaEngine.ts:41-47** | `sdcaMultiplier(1.5)` → `3.0` | `sdcaMultiplier(-1.5)` → `-0.5` | **Positive = Buy, Negative = Sell** ❌ |
| **web/src/lib/sdcaEngine.ts** | Identical to above | Identical | **WRONG** ❌ |
| **Spec** `sdca-strategy-engine/spec.md` | "Positive = Undervalued → BUY" | "Negative = Overvalued → SELL" | **WRONG** ❌ |

**Evidence from test run** (current state):
```
37 tests: 20 pass, 17 fail
Failures: all sdcaMultiplier, detectPhase, determineAction, computeSdcaSignal tests
Reason: tests expect correct (positive=sell) convention; code implements wrong (positive=buy)
```

**Impact chain of the bug:**
- `src/lib/sdcaEngine.ts` → imported by `src/lib/sdcaBacktest.ts` → imported by `src/api/routes/sdca.ts`
- `web/src/lib/sdcaEngine.ts` → used by frontend SDCA computations
- Both API endpoints (`/api/v1/sdca/signal` and `/api/v1/sdca/backtest`) produce inverted signals
- The ONLY correct implementation is `studioBacktest.ts:sdcaMultiplierLocal()` (a local copy, not imported)

---

### 2. Missing Tasks (Critical)

**Task 0 (BLOCKER — not in tasks.md): Fix sign convention in `src/lib/sdcaEngine.ts`**

The entire `sdcaMultiplier()` function must be rewritten:
```typescript
// CURRENT (WRONG):
if (composite >= 1.5) return 3.0;  // treats positive as buy
if (composite > -1.5) return 0.0;
return -0.5;

// CORRECT (per API/tests/studioBacktest):
if (composite >= 1.5) return -0.5;  // positive = overvalued = sell
if (composite >= 1.0) return 0.0;
if (composite >= 0.5) return 0.5;
if (composite > -0.5) return 1.0;
if (composite > -1.0) return 1.5;
if (composite > -1.5) return 2.0;
return 3.0;  // negative = undervalued = buy
```

The same fix must propagate to:
- **`detectPhase()`** — Phase conditions use wrong composite sign comparisons (e.g., `composite >= 1.0` for deep discount, should be `composite <= -1.0`)
- **`determineAction()`** — Entry/exit thresholds are inverted (entry at `+1.0` should be at `-1.0`, exit at `-1.0` should be at `+1.0`)
- **`regimeConfidence()`** — Overvaluation check uses wrong sign

**Task 0b: Fix sign convention in `web/src/lib/sdcaEngine.ts`**
Identical copy — same fix needed.

**Task 0c: Fix spec `openspec/specs/sdca-strategy-engine/spec.md`**
The spec itself has the wrong convention description. The table and scenarios all need inversion.

**Task 0d: Confirm `studioBacktest.ts` alignment**
`sdcaMultiplierLocal()` is already correct but is a **separate local copy** (not imported from `sdcaEngine.ts`). After fixing `sdcaEngine.ts`, a decision must be made:
- Option A: Make `studioBacktest.ts` import `sdcaMultiplier` from `sdcaEngine.ts` (single source of truth)
- Option B: Keep both copies but ensure they match

**Task 0e: Re-run and verify tests pass after fix**
Tests 17/37 already failing. After the sign fix, all should pass. This must be verified before any threshold changes.

---

### 3. Coverage Assessment: Specs → Tasks

| Spec Requirement | Covered by Task? | Issue |
|---|---|---|
| SDCA Multiplier Function (correct sign convention) | ❌ **NOT COVERED** | Tasks assume current convention is correct |
| Cycle Phase Detection (correct signs) | ❌ **NOT COVERED** | detectPhase needs sign fix |
| DCA Entry Rule (composite crosses +1.0 → buy) | ❌ **INVERTED in spec** | Correct entry is composite crosses -1.0 |
| DCA Exit Rule (composite crosses -0.5 → sell) | ❌ **INVERTED in spec** | Correct exit is composite crosses +0.5 |
| Causal Filtering | ✅ Covered (7.4) | OK |
| Transaction Cost Modeling | ✅ Task 2.4 | OK |
| Walk-Forward Validation | ✅ Task 6.5 | OK |
| Regime Confidence (correct sign) | ❌ **NOT COVERED** | regimeConfidence needs sign fix |
| Adaptive scaling (new feature) | ✅ Task 1.1 | OK (after sign fix) |
| Regime confidence weighting (new feature) | ✅ Task 1.4 | OK (after sign fix) |
| Parameter presets (new feature) | ✅ Tasks 3.1-3.3 | OK (after sign fix) |
| UI panel updates | ✅ Tasks 5.1-5.6 | OK (after sign fix) |

**6 of 12 spec requirements have no valid task coverage** because the foundational sign convention is not addressed.

---

### 4. Task Ordering Issues

**Dependency violations:**

1. **Tasks 1.1-1.6 (threshold changes) depend on sign fix** — Modifying thresholds within the wrong convention is meaningless. The sign fix MUST come first.

2. **Tasks 4.1-4.3 (frontend mirror) depend on tasks 1.x** — But they should be done simultaneously or as part of the same commit, not as a separate "mirror" step. The two files are currently byte-identical; after the fix, they should remain so.

3. **Section 6 (testing) is listed as a separate phase** — Testing should be interleaved. Task 6.1 (run existing tests) should be the FIRST task, establishing the baseline.

4. **Section 8 (documentation) comes last** — But the spec at `sdca-strategy-engine/spec.md` has the wrong convention. Updating docs MUST happen alongside code changes to avoid further confusion.

5. **`sdcaBacktest.ts` (server-side backtest) is NOT listed in tasks** — This file imports from `sdcaEngine.ts` and will inherit the sign bug. It's the critical server-side computation path.

**Recommended ordering:**
```
1. Fix sign convention in src/lib/sdcaEngine.ts (all functions)
2. Fix sign convention in web/src/lib/sdcaEngine.ts (mirror)
3. Run tests — verify 17 failures become 0
4. THEN apply threshold optimizations (tasks 1.1-1.6)
5. Update sdcaBacktest.ts defaults
6. Update API route presets
7. Update frontend studioBacktest.ts alignment
8. Update UI panel
9. Update spec docs
10. Full pipeline verification
```

---

### 5. Feasibility Concerns

1. **Scope creep vs. bug fix**: The tasks mix two distinct concerns:
   - **Bug fix**: Sign convention inversion (affects all SDCA signal computation globally)
   - **Feature work**: Threshold optimization, parameter presets, UI enhancements
   
   These should be separate changesets. Mixing them makes rollback impossible without reverting the threshold improvements too.

2. **Acceptance criteria are invalidated**: Tasks 9.1-9.4 specify metrics (Sharpe ≥ 0.91, drawdown < 75%) that are meaningless until the sign convention is fixed. After the fix, ALL metrics will change dramatically, and the targets need re-evaluation.

3. **Task granularity**: Tasks 1.1-1.6 each modify a different parameter of the same function. For a critical function like `sdcaMultiplier()`, these should be a single atomic task with the sign fix included.

4. **Verification gap**: Task 2.3 adds parameter validation ("buy: 0.0 to +2.0, sell: -2.0 to 0.0"). These ranges are based on the WRONG convention. The correct ranges are buy: -2.0 to 0.0, sell: 0.0 to +2.0.

---

### 6. Specific Task-Level Issues

| Task | Issue |
|------|-------|
| 1.1 | "adaptive scaling for composites ≥ +1.0" — In correct convention, +1.0 is the SELL zone, not the buy zone |
| 1.2 | "Change buy threshold from +1.0 to +0.5" — Buy thresholds should be negative in correct convention |
| 1.3 | "Change sell threshold from -1.0 to -1.5" — Sell thresholds should be positive in correct convention |
| 1.4 | "Regime confidence weighting" — Conceptually sound, but must use correct sign convention |
| 1.5 | "buy < 30%, sell > 75%" — OK thresholds, but buy/sell labels are swapped relative to convention |
| 1.6 | "Extended euphoria threshold from 30 to 25 days" — OK after sign fix |
| 2.1 | "buy_threshold from +1.0 to +0.5" — Same sign issue as 1.2 |
| 2.2 | "sell_threshold from -1.0 to -1.5" — Same sign issue as 1.3 |
| 2.3 | "buy: 0.0 to +2.0, sell: -2.0 to 0.0" — Inverted ranges |
| 3.1-3.3 | Preset system — OK but depends on correct base implementation |
| 4.1-4.3 | "Mirror backend changes" — Should not be a separate step; keep files identical |
| 5.5-5.6 | Chart sizing — OK, independent of sign convention |
| 6.1 | "Run existing SDCA unit tests" — 17/37 already fail; should be first task, not last |
| 9.1-9.4 | Metrics targets — Invalidated by sign fix; need re-baselining |

---

### 7. Recommendations

1. **Split into two changesets:**
   - Change A: Fix sign convention (bug fix, all engines + spec + tests)
   - Change B: Optimize thresholds and add features (on top of corrected engine)

2. **Add these missing tasks to Change A:**
   - [ ] Fix `sdcaMultiplier()`, `detectPhase()`, `determineAction()`, `regimeConfidence()` in `src/lib/sdcaEngine.ts`
   - [ ] Fix same functions in `web/src/lib/sdcaEngine.ts`
   - [ ] Verify all 37 tests pass (currently 17 fail)
   - [ ] Fix spec `openspec/specs/sdca-strategy-engine/spec.md` sign convention
   - [ ] Confirm `src/lib/sdcaBacktest.ts` produces correct results after fix
   - [ ] Confirm `src/api/routes/sdca.ts` signal/backtest endpoints return correct signals
   - [ ] Decide: merge `studioBacktest.ts:sdcaMultiplierLocal()` with `sdcaEngine.ts` or keep in sync

3. **For Change B (current tasks.md), add:**
   - [ ] Re-baseline metrics after sign fix before setting new targets
   - [ ] Fix task 2.3 parameter validation ranges
   - [ ] Fix task 1.2/1.3 threshold directions
   - [ ] Add `src/lib/sdcaBacktest.ts` to task scope
   - [ ] Interleave testing (not a separate final phase)

---

## Review

- **Correct**: Tasks 5.5-5.6 (chart Y-axis lock, crosshair sync) are independent and correctly specified. Tasks 7.1-7.4 (pipeline verification) are comprehensive. The general structure of sections 3, 5, 8 is reasonable.

- **Fixed**: Nothing — this is a review-only task. The sign convention bug in `sdcaEngine.ts` is confirmed but not remediated.

- **Blocker**: **The entire tasks.md is predicated on a wrong sign convention.** No threshold optimization can proceed until `sdcaMultiplier()` and all downstream functions are corrected. Executing tasks 1.1-1.6 and 2.1-2.3 on the current (inverted) engine will produce signals that BUY at market tops and SELL at market bottoms — the exact opposite of the intended strategy. 17 of 37 tests already fail for this reason.

- **Note**: The `studioBacktest.ts:sdcaMultiplierLocal()` is the ONLY correct implementation in the codebase. It should become the reference for fixing `sdcaEngine.ts`, not the other way around. The spec at `sdca-strategy-engine/spec.md` also has the wrong convention and needs correction alongside the code.