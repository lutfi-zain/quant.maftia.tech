## Context

See `proposal.md` for motivation and mathematical justification.

The Full-Cycle Macro Rotation strategy models institutional capital rotation across multi-year Bitcoin cycles:
1. Accumulate BTC when valuations are at generational bottoms ($V \ge 1.80$).
2. Rotate 100% cash to BTC when exiting deep discount bottoms ($V \le 1.50$) or upon confirmed breakout.
3. Systematically distribute (sell 15% BTC/week) during parabolic bubble tops ($V \le -1.50$).
4. Fully liquidate remaining BTC holdings to cash when the bubble deflates back to fair value ($V \ge 0.00$), sitting out -80% bear markets in cash.

## Goals / Non-Goals

**Goals:**
- Implement identical 4-State Cycle Rotation FSM across Python (`engine.py`, `backtest.py`) and TypeScript (`sdcaEngine.ts`, `sdcaBacktest.ts`).
- Standardize threshold defaults: `dca_in_start: 1.80`, `all_in_val: 1.50`, `dca_out_start: -1.50`, `all_out_val: 0.00`.
- Achieve 100% parity with +22,774% Total Return ($2.27M on $10k initial, 54.6% CAGR vs Buy & Hold 47.10%).

**Non-Goals:**
- No changes to indicator mathematical formulas or database schema.

## Decisions

### Decision 1: 4-State Macro Rotation FSM
In `sdcaEngine.ts` and `engine.py`:
```typescript
if (currentMacroState === "OUT_ALL") {
    if (comp_t1 >= t.dca_in_start) { // 1.80
        currentMacroState = "DCA_IN";
    }
} else if (currentMacroState === "DCA_IN") {
    if (comp_t1 <= t.all_in_val) { // 1.50
        currentMacroState = "ALL_IN";
    }
} else if (currentMacroState === "ALL_IN") {
    if (comp_t1 <= t.dca_out_start) { // -1.50
        currentMacroState = "DCA_OUT";
    }
} else if (currentMacroState === "DCA_OUT") {
    if (comp_t1 >= t.all_out_val) { // 0.00
        currentMacroState = "OUT_ALL";
    }
}
```

### Decision 2: Execution Rules
- `ALL_IN`: On transition day, allocate 100% remaining cash to BTC (`multiplier = 999.0`). Subsequent days hold.
- `DCA_IN`: On transition or Mondays, buy value-weighted DCA (`multiplier = 2.0`).
- `DCA_OUT`: On transition or Mondays, sell 15% of active BTC position (`multiplier = -0.15`).
- `OUT_ALL`: On transition day, sell 100% remaining BTC position to cash (`multiplier = -1.0`). Subsequent days hold in cash.

## Risks / Trade-offs

- **Holding Cash During Bear Markets**: Exiting to 100% cash when $V \ge 0.00$ after a bubble top protects capital from -80% drawdowns, but requires disciplined patience while waiting for the next bottom ($V \ge 1.80$). This is the core source of the strategy's massive +7.5% CAGR alpha over Buy & Hold.
