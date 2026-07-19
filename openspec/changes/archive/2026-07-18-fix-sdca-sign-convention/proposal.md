## Why

The SDCA (Strategic Dollar Cost Averaging) engine has a **critical sign convention bug** that causes it to execute the exact opposite of correct strategy behavior. The engine currently treats positive `valuation_composite` values as "overvalued" (sell signals) and negative values as "undervalued" (buy signals). However, the Valuation System produces the **opposite**: positive composites indicate many indicators showing undervaluation (buy zone), while negative composites indicate overvaluation (sell zone).

**Evidence:**

- On Dec 25, 2018 (BTC at $3,794, cycle bottom), composite was +1.9505
- SDCA engine incorrectly signals "SELL ALL" at this accumulation opportunity
- On Dec 25, 2024 (BTC at $98,844, bull market), composite was ~ -0.5
- SDCA engine would incorrectly signal "BUY" during market euphoria

This bug renders all SDCA backtest metrics invalid and would cause any live/paper trading portfolio to buy at tops and sell at bottoms.

## What Changes

- **BREAKING**: Invert the sign convention in `sdcaMultiplier()` function — positive composites now map to high buy multipliers (+2.0x, +3.0x), negative composites map to sell multipliers (-0.5x)
- **BREAKING**: Invert `detectPhase()` classification — positive composites classify as "deep_discount" / "value", negative composites classify as "expansion" / "euphoria"
- **BREAKING**: Invert `determineAction()` entry/exit rules — "START_AGGRESSIVE_DCA" triggers on composite crossing above +1.0, "SELL_ALL" triggers on composite crossing below -1.0
- **BREAKING**: Invert `regimeConfidence()` logic — prolonged positive composite without price rise indicates low confidence
- Fix the existing `sdca-strategy-engine` spec to document correct sign convention
- Re-run all backtests and update portfolio state to reflect corrected signals

## Capabilities

### New Capabilities

(None — this is a bug fix, not new functionality)

### Modified Capabilities

- `sdca-strategy-engine`: Fix the documented and implemented sign convention. The existing spec incorrectly states positive composite = overvalued. The correct convention is: positive composite = undervalued (many indicators showing bottom signals), negative composite = overvalued (many indicators showing top signals). All multiplier mappings, phase detection thresholds, entry/exit rules, and confidence logic must be inverted.

## Impact

**Affected Systems:**

- **Valuation System**: No changes needed — the composite calculation is correct
- **SDCA Engine**: `src/lib/sdcaEngine.ts` and `web/src/lib/sdcaEngine.ts` — core logic inversion
- **SDCA Panel**: `web/src/components/studios/SdcaPanel.tsx` — may need display label updates
- **SDCA Backtest**: `src/lib/sdcaBacktest.ts` and `web/src/lib/studioBacktest.ts` — re-run with corrected logic
- **SDCA Portfolio**: `web/src/lib/sdcaPortfolio.ts` — portfolio state may need reset/recalculation

**Data Impact:**

- All historical SDCA signals are incorrect and need regeneration
- Any portfolio state based on old signals should be reset
- Backtest performance metrics (Sharpe ratio, returns, drawdowns) will change significantly

**Non-Goals:**

- No changes to the Valuation System composite calculation (it is correct)
- No changes to LTTD, MTTD, or Ichimoku systems
- No changes to `quant-technical-indicator-bank` (deprecated and removed)
- No changes to data ingestion pipelines or database schemas
