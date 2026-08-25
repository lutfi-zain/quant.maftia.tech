## Context

See `proposal.md` for background and motivation.

The platform currently logs consolidated multi-system daily outputs into the `unified_daily_analytics` table in `maftia_quant.db`:
- **System 1**: `valuation_composite` (Macro Cycle Score $[-2.0, +2.0]$)
- **System 2**: `lttd_regime`, `lttd_prob_bull`, `lttd_prob_bear`, `lttd_prob_sideways`, `lttd_target_exposure`
- **System 3**: `mttd_imo`, `mttd_position`, `mttd_er`, `mttd_entropy`
- **System 4**: `ichimoku_imo`, `ichimoku_position`

By mapping the SDCA FSM state transitions directly to these canonical columns, we achieve a zero-hardcode, self-adapting allocation engine.

## Goals / Non-Goals

**Goals:**
- Extend `DailyRecord` in Python and TypeScript to ingest the full set of canonical 4-system signals.
- Implement the `is_unanimous_breakout(record_t1)` consensus evaluator across Python and TypeScript SDCA engines.
- Refactor the FSM state machine to eliminate deadlocks and support continuous weekly DCA accumulation during extended bear markets with reversible transitions.
- Maintain 100% mathematical parity across Python batch execution and TypeScript API endpoints.

**Non-Goals:**
- No changes to Gaussian HMM training algorithms, Ehlers filter constants, or database schemas.

## Decisions

### Decision 1: Canonical Multi-System `DailyRecord` Interface
In Python (`engines/valuation/quant/sdca/engine.py`) and TypeScript (`src/lib/sdcaEngine.ts` & `web/src/lib/sdcaEngine.ts`):
```typescript
export interface DailyRecord {
    date: string;
    close: number;
    valuation_composite?: number;
    lttd_regime?: string;
    lttd_prob_bull?: number;
    lttd_prob_sideways?: number;
    lttd_target_exposure?: number;
    mttd_imo?: number;
    mttd_position?: number;
    mttd_er?: number;
    mttd_entropy?: number;
    ichimoku_imo?: number;
    ichimoku_position?: number;
    price_ma200_ratio?: number;
    ath_drawdown?: number;
}
```

### Decision 2: Dynamic Multi-System Consensus Function
```typescript
function checkUnanimousBreakout(d: DailyRecord): boolean {
    const valFavorable = (d.valuation_composite ?? 0.0) >= 0.0;
    const lttdBull = (d.lttd_prob_bull ?? 0.0) >= 0.60 || d.lttd_regime === "BULL" || (d.lttd_target_exposure ?? 0.0) > 0.5;
    const mttdConfirmed = (d.mttd_position ?? 0.0) > 0 || ((d.mttd_er ?? 0.0) >= 0.20 && (d.mttd_entropy ?? 3.0) <= 2.30) || (d.mttd_imo ?? 0.0) > 0.25;
    const ichiConfirmed = (d.ichimoku_position ?? 0.0) > 0 || (d.ichimoku_imo ?? 0.0) > 0.30;

    return valFavorable && lttdBull && mttdConfirmed && ichiConfirmed;
}
```

### Decision 3: Reversible 3-Phase FSM Architecture
1. **DCA_IN (Continuous Accumulation)**:
   - When `valuation_composite >= +0.50`, state enters or remains in `DCA_IN`.
   - Executes value-scaled DCA on Mondays: $1.5\times$ if $V \in [0.5, 1.0)$, $2.0\times$ if $V \in [1.0, 1.5)$, $3.0\times$ if $V \ge 1.50$.
   - Does NOT transition to `ALL_IN` merely on temporary price bounces or valuation drops.
2. **ALL_IN (Unanimous Breakout)**:
   - Transitions to `ALL_IN` ONLY when `checkUnanimousBreakout(day_t1)` is `true` and `buy_all_fired` is `false`.
   - Fires `BUY_ALL` (100% remaining cash) on the transition date.
   - Sets `buy_all_fired = true`.
3. **Reversible Safety Valve**:
   - If market crashes back to deep discount ($V \ge 1.50$) with `lttd_regime == 'BEAR'`, `buy_all_fired` resets to allow fresh accumulation if new cash is injected.
4. **Macro Distribution (DCA_OUT & ALL_OUT)**:
   - `DCA_OUT`: Scaled selling on Mondays when $V \le -1.00$.
   - `ALL_OUT`: 100% exit to cash when $V \le -1.50$ (Macro Cycle Bubble).
   - Resets `buy_all_fired = false` upon exiting at cycle top.

## Risks / Trade-offs

- **Fewer ALL_IN Triggers**: Requiring unanimous 4-system consensus means `ALL_IN` will fire only 1–2 times per 4-year cycle (at confirmed macro breakouts like early 2019 and early 2023). This is mathematically intentional: it protects capital from dead-cat bounces while allowing weekly DCA to capture true generational bottoms.
