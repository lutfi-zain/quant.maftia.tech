## Why

**CRITICAL BUG DISCOVERED:** The SDCA (Strategic Dollar Cost Averaging) strategy has an **inverted sign convention** in `sdcaEngine.ts` that causes it to **BUY at market tops and SELL at market bottoms** — the exact opposite of dollar-cost averaging intent.

### Evidence Chain (4 Independent Sources Agree)

| Source | Convention | Evidence |
|--------|------------|----------|
| Valuation System Doc §4.1 | `Composite ≥ +1.50` = Overvalued | `docs/01_quant_btc_valuation_system.md` |
| API Daily Route | `bubble_warning: composite >= 1.5` | `src/api/routes/daily.ts:55` |
| Test File | `sdcaMultiplier(1.6)` → expects `-0.5` (sell) | `web/src/lib/__tests__/sdcaEngine.test.ts:19` |
| studioBacktest.ts | `composite >= 1.5` → `-0.5` (sell) | `web/src/lib/studioBacktest.ts:463` |

### Current Bug Impact

```typescript
// CURRENT (WRONG) — sdcaEngine.ts:
if (composite >= 1.5) return 3.0;  // Buys 3x when OVERVALUED ❌
if (composite > -1.5) return 0.0;  // Pauses when UNDERVALUED ❌
return -0.5;                        // Sells at CYCLE BOTTOM ❌
```

**Test confirmation:** 17 of 37 tests FAIL — all sign-convention related.

**Performance impact:**

- SDCA underperforms Simple DCA by **-13.4%** relative (10,698% vs 12,356%)
- Max drawdown of **81.5%** (heavy buying at euphoria peaks)
- Grid search optimization yields minimal improvement because **you cannot optimize an inverted strategy**

## What Changes

This change is split into **two phases** to address the critical bug first, then optimize:

### Phase A: Fix Sign Convention (Bug Fix — CRITICAL)

- **Fix `sdcaMultiplier()` function**: Revert to correct convention (positive = overvalued/sell, negative = undervalued/buy)
- **Fix `detectPhase()` function**: Correct phase detection logic to use proper sign comparisons
- **Fix `determineAction()` function**: Correct entry/exit thresholds (entry at -1.0, exit at +0.5)
- **Fix `regimeConfidence()` function**: Correct overvaluation check logic
- **Sync frontend**: Mirror fixes to `web/src/lib/sdcaEngine.ts`
- **Fix spec**: Update `openspec/specs/sdca-strategy-engine/spec.md` with correct convention
- **Verify tests**: All 37 tests must pass (currently 17 fail)

### Phase B: Optimize Thresholds (Feature Work — after Phase A)

- **Optimize buy threshold**: Adjust from -1.0 to -0.5 for earlier accumulation during undervaluation
- **Optimize sell threshold**: Adjust from +1.0 to +1.5 for more aggressive profit-taking during euphoria
- **Add adaptive position sizing**: Scale multiplier based on composite strength to reduce overexposure
- **Enhance regime confidence weighting**: Apply confidence multiplier to position sizing when regime is uncertain
- **Add parameter presets**: Conservative, moderate, aggressive configuration options

## Capabilities

### New Capabilities

None — this change modifies existing SDCA strategy engine behavior.

### Modified Capabilities

- `sdca-strategy-engine`: **Phase A**: Fix sign convention in all functions. **Phase B**: Optimize thresholds and add adaptive scaling
- `sdca-backend-computation`: **Phase B**: Update server-side backtest to use optimized parameters
- `sdca-studio-panel`: **Phase B**: Update frontend to display optimized parameter configuration

## Impact

### Systems Affected

- **Valuation System**: `valuation_composite` signal source (read-only, no changes to calculation)
- **SDCA Strategy Engine**: Core signal computation logic (`src/lib/sdcaEngine.ts`)
- **SDCA Backtest Engine**: Server-side backtest computation (`src/lib/sdcaBacktest.ts`)
- **SDCA API Routes**: Parameter configuration endpoints (`src/api/routes/sdca.ts`)
- **SDCA Studio Panel**: Frontend display and configuration (`web/src/components/studios/SdcaPanel.tsx`)

### Code Changes

**Phase A (Bug Fix):**

- `src/lib/sdcaEngine.ts`: Fix `sdcaMultiplier()`, `detectPhase()`, `determineAction()`, `regimeConfidence()`
- `web/src/lib/sdcaEngine.ts`: Mirror backend fixes
- `openspec/specs/sdca-strategy-engine/spec.md`: Fix sign convention documentation

**Phase B (Optimization):**

- `src/lib/sdcaEngine.ts`: Add adaptive scaling, adjust thresholds
- `src/lib/sdcaBacktest.ts`: Update default parameters
- `src/api/routes/sdca.ts`: Add parameter presets
- `web/src/components/studios/SdcaPanel.tsx`: Add preset selector UI

### Non-Goals

- **Do NOT modify** the Valuation System's `valuation_composite` calculation
- **Do NOT modify** the LTTD, MTTD, or Ichimoku systems
- **Do NOT introduce** deprecated `quant-technical-indicator-bank` components
- **Do NOT change** the t-1 causal filtering enforcement (strict temporal integrity)

## Impact Summary

| Component | Phase A | Phase B | Risk Level |
|-----------|---------|---------|------------|
| SDCA Strategy Engine | Bug fix | Optimization | High (A) / Medium (B) |
| SDCA Backtest Engine | Inherits fix | Parameter update | Low |
| SDCA API Routes | Inherits fix | Configuration update | Low |
| SDCA Studio Panel | Inherits fix | Display update | Low |
| Valuation System | None | None | None |
| LTTD/MTTD/Ichimoku | None | None | None |
