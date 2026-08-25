## Why

The SDCA Strategy Engine currently utilizes a primitive `price_t1 crosses above MA200` condition to trigger `BUY_ALL` (all-in capital allocation at cycle bottoms). In market bottoms (e.g. November 2022 at $16k), Bitcoin's price does not cross above the 200-day moving average until months later ($28k in March 2023, a +75% late lag). Furthermore, MA200 is prone to severe whipsaws during prolonged chop. 

The platform already possesses institutional-grade quantitative engines: **System 2 (LTTD Gaussian HMM)** with probabilistic regime classification ($P_{\text{Bull}} > 0.60$) and **System 3 (MTTD)** with Kaufman Efficiency Ratio ($ER \ge 0.20$) and Shannon Entropy noise filtering. Replacing MA200 with causal LTTD Regime and MTTD Efficiency Ratio confluence creates an integrated, statistically sound breakout confirmation for bottom allocations.

## What Changes

- **Deprecate MA200 Crossover in SDCA Engine**: Remove `cross_above_ma200` dependency from `BUY_ALL` trigger logic in Python (`engine.py`), backend TypeScript (`src/lib/sdcaEngine.ts`), and frontend TypeScript (`web/src/lib/sdcaEngine.ts`).
- **Implement Multi-System Confluence Trigger for BUY_ALL**:
  - Require `valuation_composite >= +1.0` (deep undervaluation).
  - Require `lttd_prob_bull > 0.60` (or `lttd_regime == 'BULL'`) as causal structural trend confirmation.
  - Require `mttd_er >= 0.20` (Kaufman Efficiency Ratio showing persistent non-noise trend).
- **Synchronize Database Queries**: Ensure `unified_daily_analytics` query feeds `lttd_prob_bull` and `mttd_er` into SDCA `DailyRecord`.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `sdca-strategy-engine`: Update `BUY_ALL` entry requirements to replace MA200 crossover with LTTD Bull Probability and MTTD Efficiency Ratio confirmation.

## Impact & System Scope

- **Impacted Systems**: System 1 SDCA Module (`quant-btc-valuation-system`), API Gateway SDCA endpoints, and Frontend SDCA Panel.
- **Zero Lookahead Bias**: Strictly maintained via $t-1$ lag on `valuation_composite`, `lttd_prob_bull`, and `mttd_er`.
- **Non-Goals**:
  - No alteration of the underlying LTTD HMM or MTTD mathematical engines.
  - No changes to valuation indicator normalizations.
