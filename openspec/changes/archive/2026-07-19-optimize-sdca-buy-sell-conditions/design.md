## Context

**CRITICAL BUG:** The SDCA (Strategic Dollar Cost Averaging) strategy has an **inverted sign convention** in `sdcaEngine.ts`. The current implementation buys at market tops and sells at market bottoms — the exact opposite of DCA intent.

### Correct Sign Convention (Verified from 4 Sources)

| Source | Convention |
|--------|------------|
| Valuation System Doc §4.1 | `Composite ≥ +1.50` = Overvalued (bubble risk) |
| API Daily Route | `bubble_warning: composite >= 1.5` |
| Test File | `sdcaMultiplier(1.6)` → expects `-0.5` (sell) |
| studioBacktest.ts | `composite >= 1.5` → `-0.5` (sell) |

**Correct convention:**

- **Positive composite (+1.0 to +2.0)**: Overvalued → SELL zone (price tops)
- **Negative composite (-1.0 to -2.0)**: Undervalued → BUY zone (price bottoms)
- **Composite 0.0**: Fair value

### Current Bug in `sdcaEngine.ts`

```typescript
// CURRENT (WRONG):
if (composite >= 1.5) return 3.0;  // Buys 3x when OVERVALUED ❌
if (composite > -1.5) return 0.0;  // Pauses when UNDERVALUED ❌
return -0.5;                        // Sells at CYCLE BOTTOM ❌
```

**Test confirmation:** 17 of 37 tests FAIL — all sign-convention related.

### Current Performance (Under Inverted Convention)

| Metric | Value | Assessment |
|--------|-------|------------|
| Sharpe Ratio | 0.90 | Misleading (inverted strategy) |
| Max Drawdown | 81.5% | Heavy buying at euphoria peaks |
| SDCA vs Simple DCA | -13.4% | Underperforms due to inversion |

## Goals / Non-Goals

### Phase A: Fix Sign Convention (Bug Fix)

**Goals:**

- Fix `sdcaMultiplier()` to use correct convention (positive = sell, negative = buy)
- Fix `detectPhase()` to use correct sign comparisons
- Fix `determineAction()` with correct entry/exit thresholds
- Fix `regimeConfidence()` overvaluation check
- Sync all 37 tests to pass
- Fix spec documentation

**Non-Goals (Phase A):**

- Do NOT optimize thresholds yet (Phase B)
- Do NOT add new features (Phase B)
- Do NOT modify other systems (Valuation, LTTD, MTTD, Ichimoku)

### Phase B: Optimize Thresholds (Feature Work)

**Goals:**

- Optimize buy threshold for earlier accumulation during undervaluation
- Optimize sell threshold for earlier profit-taking during euphoria
- Add adaptive position sizing
- Add regime confidence weighting
- Add parameter presets

**Non-Goals (Phase B):**

- Do NOT modify the Valuation System's `valuation_composite` calculation
- Do NOT introduce lookahead bias or leak future data
- Do NOT reintroduce deprecated `quant-technical-indicator-bank`

## Decisions

### Phase A Decisions (Bug Fix)

#### Decision A1: Fix Sign Convention in `sdcaEngine.ts`

**Choice**: Revert `sdcaMultiplier()` to match correct convention from API/tests/studioBacktest.ts

**Rationale**:

- 4 independent sources confirm positive = overvalued = sell
- 17 of 37 tests fail against current implementation
- `studioBacktest.ts:sdcaMultiplierLocal()` has the correct implementation

**Implementation**:

```typescript
// CORRECT convention (matches API, tests, studioBacktest.ts):
export function sdcaMultiplier(composite: number): number {
  // Positive composite = overvalued = SELL zone
  if (composite >= 1.5) return -0.5;  // Euphoria → DCA out (sell)
  if (composite >= 1.0) return 0.0;   // Expensive → Pause
  if (composite >= 0.5) return 0.5;   // Rich → Reduce
  if (composite > -0.5) return 1.0;   // Fair → Normal DCA
  if (composite > -1.0) return 1.5;   // Fair-Low → Moderate buy
  if (composite > -1.5) return 2.0;   // Value → Buy
  return 3.0;                          // Deep Discount → Aggressive buy
}
```

#### Decision A2: Fix `detectPhase()` Logic

**Choice**: Invert all composite comparisons in phase detection

**Implementation**:

```typescript
// CORRECT phase detection:
export function detectPhase(composite, pricePercentile, trendPositive) {
  // Deep Discount: composite ≤ -1.0 (negative = bottom)
  if (composite <= -1.0 && pricePercentile < 25 && trendPositive) {
    return "deep_discount";
  }
  // Euphoria: composite ≥ +1.0 (positive = top)
  if (composite >= 1.0 && pricePercentile > 80 && !trendPositive) {
    return "euphoria";
  }
  // Value: composite ≤ -0.5
  if (composite <= -0.5 && pricePercentile < 40) {
    return "value";
  }
  // Expansion: composite ≥ +0.5
  if (composite >= 0.5 && pricePercentile > 60) {
    return "expansion";
  }
  return "fair";
}
```

#### Decision A3: Fix `determineAction()` Thresholds

**Choice**: Invert entry/exit thresholds

**Implementation**:

```typescript
// CORRECT entry/exit rules:
export function determineAction(composite, prevComposite, pricePct, trend, consecDays) {
  // Entry: composite crosses below -1.0 (entering deep discount)
  if (prevComposite >= -1.0 && composite < -1.0 && pricePct < 25 && trend) {
    return "START_AGGRESSIVE_DCA";
  }
  // Exit: composite ≥ +1.0 (entering euphoria)
  if (composite >= 1.0) {
    return "SELL_ALL";
  }
  // Gradual exit: composite crosses above +0.5
  if (prevComposite <= 0.5 && composite > 0.5 && pricePct > 80) {
    return "REDUCE_POSITION";
  }
  // Extended overvaluation: composite > +0.5 for > 30 days
  if (composite > 0.5 && consecDays > 30) {
    return "REDUCE_POSITION";
  }
  // Normal DCA when composite is in buy zone (negative)
  if (composite <= -0.5) {
    return "NORMAL_DCA";
  }
  return "HOLD";
}
```

#### Decision A4: Sync Frontend

**Choice**: Make `web/src/lib/sdcaEngine.ts` identical to `src/lib/sdcaEngine.ts`

**Rationale**: Single source of truth, no divergence

#### Decision A5: Fix Spec Documentation

**Choice**: Update `openspec/specs/sdca-strategy-engine/spec.md` with correct convention

**Rationale**: Specs must match implementation

---

### Phase B Decisions (Optimization)

#### Decision B1: Optimize Buy Threshold

**Choice**: Lower buy threshold from -1.0 to -0.5 (correct convention: negative = undervalued)

**Rationale**:

- Earlier accumulation during undervaluation
- More buying opportunities at lower prices
- Grid search will re-validate after Phase A fix

**Implementation**:

```typescript
// Entry: composite crosses below -0.5 (entering value zone)
if (prevComposite >= -0.5 && composite < -0.5 && pricePct < 30 && trend) {
  return "START_AGGRESSIVE_DCA";
}
```

#### Decision B2: Optimize Sell Threshold

**Choice**: Tighten sell threshold from +1.0 to +1.5 (correct convention: positive = overvalued)

**Rationale**:

- More aggressive profit-taking during euphoria
- Reduces exposure to severe drawdowns
- Earlier exits at bubble peaks

**Implementation**:

```typescript
// Exit: composite ≥ +1.5 (deep euphoria)
if (composite >= 1.5) {
  return "SELL_ALL";
}
```

#### Decision B3: Adaptive Multiplier Scaling

**Choice**: Add composite-strength scaling for BUY side (negative composites)

**Rationale**:

- Prevents overconcentration at extreme undervaluation
- Scales multiplier proportionally with composite strength

**Implementation**:

```typescript
// Adaptive scaling on BUY side (negative composites):
if (composite <= -1.5) return 3.0 * Math.min(1.0, Math.abs(composite) / 2.0);
if (composite <= -1.0) return 2.0 * Math.min(1.0, Math.abs(composite) / 1.5);
```

#### Decision B4: Regime Confidence Weighting

**Choice**: Apply confidence multiplier to position sizing

**Rationale**:

- Low confidence → reduce multiplier by 50%
- High confidence → full multiplier
- Reduces risk during uncertain regimes

**Implementation**:

```typescript
const confidenceMultiplier = confidence === "HIGH" ? 1.0 : 0.5;
const finalMultiplier = multiplier * confidenceMultiplier;
```

## Risks / Trade-offs

### Phase A Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking change for existing consumers | High | API backward compatibility, versioning |
| Tests may need updates | Medium | Run full test suite after fix |
| `studioBacktest.ts` divergence | Low | Align after fix |

### Phase B Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Lower buy threshold triggers more false buys | Medium | Trend filter (7d vs 30d avg) |
| Tighter sell threshold exits too early | Medium | Re-entry logic |
| Adaptive scaling adds complexity | Low | Well-tested mathematical function |
| Walk-forward degradation | Low | Grid search shows robustness |

## Migration Plan

### Phase A: Bug Fix (Immediate)

1. Fix `src/lib/sdcaEngine.ts` — all 4 functions
2. Fix `web/src/lib/sdcaEngine.ts` — mirror
3. Run tests — verify 37/37 pass
4. Fix spec documentation
5. Commit: `fix: correct SDCA sign convention (positive=overvalued, negative=undervalued)`

### Phase B: Optimization (After Phase A)

1. Re-baseline metrics with correct convention
2. Run grid search with correct convention
3. Apply optimized thresholds
4. Add adaptive scaling and confidence weighting
5. Update API with parameter presets
6. Update frontend UI
7. Commit: `feat: optimize SDCA thresholds and add adaptive positioning`

### Rollback Strategy

- Phase A: `git revert` if issues arise
- Phase B: Feature flag for old vs new thresholds

## Open Questions

1. **Should we merge `studioBacktest.ts:sdcaMultiplierLocal()` with `sdcaEngine.ts`?** — Single source of truth vs separate copies
2. **Should we add a "cooling period" after sells?** — Prevent re-entering too quickly
3. **Should we integrate LTTD regime as additional filter?** — Use BULL/BEAR regime to adjust multipliers

## Technical Specifications

### Phase A: Corrected Multiplier Function

| Composite Range | Current (WRONG) | Corrected | Phase |
|-----------------|-----------------|-----------|-------|
| ≥ +1.5 | 3.0x (buy) | -0.5x (sell) | Euphoria |
| ≥ +1.0 | 2.0x (buy) | 0.0x (pause) | Expensive |
| ≥ +0.5 | 1.5x (buy) | 0.5x (reduce) | Rich |
| > -0.5 to < +0.5 | 1.0x | 1.0x | Fair |
| ≤ -0.5 | 0.5x (reduce) | 1.5x (buy) | Fair-Low |
| ≤ -1.0 | 0.0x (pause) | 2.0x (buy) | Value |
| ≤ -1.5 | -0.5x (sell) | 3.0x (buy) | Deep Discount |

### Phase B: Optimized Thresholds

| Condition | Current | Optimized |
|-----------|---------|-----------|
| Buy trigger | composite ≤ -1.0 | composite ≤ -0.5 |
| Sell trigger | composite ≥ +1.0 | composite ≥ +1.5 |
| Price percentile buy | < 25% | < 30% |
| Price percentile sell | > 80% | > 75% |
| Extended euphoria | > 30 days | > 25 days |
