## Why

The Strategic Dollar Cost Averaging (SDCA) engine currently suffers from two fundamental design flaws:
1. **Hardcoded Fragile Triggers**: The engine relies on hardcoded pseudo-breakout conditions (such as `comp_t1 <= 1.50` or static moving averages) that caused a catastrophic premature All-In during the July 20, 2022 dead-cat bounce ($23.2k), locking the FSM in `HOLD` and completely halting DCA purchases at the true cycle bottom ($15.7k in November 2022).
2. **Disconnected System Architecture**: Despite the platform possessing 4 institutional-grade quantitative systems (`Valuation Composite`, `LTTD Gaussian HMM`, `MTTD Multi-Principle Consensus`, and `Ichimoku SuperSmoother`), the SDCA allocation engine operated in a silo without consuming the live consensus states of these systems.

When all 4 quantitative systems reach unanimous consensus that a structural macro bull trend has commenced, holding cash incurs a severe **cash drag penalty**. Conversely, during bear market capitulations when trend systems are bearish/sideways, DCA accumulation should run continuously without premature All-In lockouts. 

This change replaces all hardcoded heuristics with a **zero-hardcode, dynamic 3-Phase Lifecycle Architecture** driven directly by live multi-system signals from `unified_daily_analytics`.

## What Changes

- **Eliminate All Hardcoded Triggers**:
  - Remove all arbitrary level-crossing checks (`comp_t1 <= all_in_val`, `drawdown_t1 >= 20.0`, `sma30_t1`).
  - Make all threshold parameters dynamic and configurable via `DEFAULT_SDCA_THRESHOLDS` and `ConfigurationPanel`.
- **Dynamic 4-System Consensus Integration**:
  - Ingest canonical signals from `unified_daily_analytics`: `valuation_composite`, `lttd_regime`, `lttd_prob_bull`, `lttd_target_exposure`, `mttd_imo`, `mttd_position`, `mttd_er`, `mttd_entropy`, `ichimoku_imo`, and `ichimoku_position`.
  - Enforce causal $t-1$ verification across all multi-system inputs.
- **Dynamic 3-Phase Lifecycle FSM**:
  - **Phase 1: Accumulation Zone (DCA Mode)**:
    - Active when `valuation_composite >= +0.50` (Value Zone) while trend systems are BEAR/SIDEWAYS.
    - Executes value-weighted Monday DCA ($1.5\times$ for $[0.5, 1.0)$, $2.0\times$ for $[1.0, 1.5)$, $3.0\times$ for $\ge 1.5$).
    - Fully resilient: DCA continues uninterrupted throughout bear market bottoms without state deadlocks.
  - **Phase 2: Unanimous Trend Breakout (ALL-IN Mode)**:
    - Triggered when ALL 4 systems reach consensus:
      1. `ValuationComposite >= 0.0` (Aset berada di valuasi wajar atau murah)
      2. `LTTDRegime == 'BULL'` or `lttd_prob_bull >= 0.60` (Tren makro terkonfirmasi)
      3. `MTTDPosition > 0` or (`mttd_er >= 0.20` and `mttd_entropy <= 2.30`) (Noise gate lolos)
      4. `IchimokuPosition > 0` or `ichimoku_imo > 0.30` (Momentum awan SuperSmoother terkonfirmasi)
    - Allocates 100% of remaining portfolio cash into BTC (multiplier `999.0`), eliminating cash drag during verified bull runs.
  - **Phase 3: Macro Distribution (DCA-OUT & ALL-OUT Mode)**:
    - `DCA_OUT`: Scaled selling on Mondays when `valuation_composite <= -1.00`.
    - `ALL_OUT`: 100% exit to cash when `valuation_composite <= -1.50` (Extreme Macro Bubble Risk).
  - **Reversible Dynamic States**: If a breakout fails and market returns to deep undervaluation (`valuation_composite >= 1.50`) with BEAR regime, the FSM gracefully reverts to `DCA_IN` accumulation mode.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `sdca-strategy-engine`: Replace hardcoded allocation heuristics with dynamic 4-system consensus breakout execution and reversible 3-phase lifecycle FSM.

## Impact & System Scope

- **Impacted Systems**: System 1 SDCA Strategy Engine (`engines/valuation/quant/sdca/engine.py`, `src/lib/sdcaEngine.ts`, `web/src/lib/sdcaEngine.ts`), SQL queries, and Valuation Studio.
- **Zero Lookahead Bias**: Strictly preserved; all 4-system consensus evaluations use causal $t-1$ daily analytics data.
- **Maintainability**: Future adjustments to LTTD HMM parameters or MTTD indicators will automatically propagate to SDCA without requiring hardcoded code changes.
- **Non-Goals**:
  - No changes to underlying LTTD, MTTD, or Ichimoku training pipelines.
