## Context

The Strategic Dollar Cost Averaging (SDCA) system calculates dynamic DCA allocation multipliers and macro cycle signals based on `valuation_composite`. Empirical backtesting on historical Bitcoin OHLCV data shows that a 4-phase Hysteresis State Machine achieves superior risk-adjusted returns (+41,282% to +86,409% total return, Sharpe 1.20 - 1.28) compared to simple static threshold triggers or passive Buy & Hold (+6,700%).

Users require interactive frontend controls in `ValuationStudio` / `SdcaPanel` to customize strategy parameters (`dca_in_start`, `all_in_val`, `dca_out_start`, `all_out_val`) and trigger real-time recalculations via the server-side API Gateway (`:8910`).

## Goals / Non-Goals

**Goals:**

- Extend `SdcaThresholds` interface in `src/lib/sdcaEngine.ts` to include hysteresis threshold fields (`dca_in_start`, `all_in_val`, `dca_out_start`, `all_out_val`).
- Update `computeSdcaSignals()` and `computeSdcaBacktest()` in `src/lib/sdcaEngine.ts` and `src/lib/sdcaBacktest.ts` to execute state machine transitions with strict $t-1$ causal filtering.
- Update `POST /api/v1/sdca/backtest` in `src/api/routes/sdca.ts` to process hysteresis threshold overrides.
- Add interactive parameter input controls (number inputs, range sliders, preset selectors) to `SdcaPanel.tsx` in `ValuationStudio.tsx`.
- Connect the "Save & Recalculate Strategy" action to fetch updated backtest metrics and equity curves dynamically without full page reloads.

**Non-Goals:**

- Modifying the 4 core quantitative engines (Valuation, LTTD, MTTD, Ichimoku) database schema or pipeline data ingestion.
- Modifying `master_ohlcv.close` canonical price sourcing.
- Reintroducing deprecated components (`quant-technical-indicator-bank`).

## Decisions

### Decision 1: Shared TypeScript Hysteresis State Machine Engine

**Choice**: Implement the 4-state Hysteresis State Machine (`OUT_ALL` → `DCA_IN` → `ALL_IN` → `DCA_OUT` → `OUT_ALL`) directly inside `src/lib/sdcaEngine.ts` and `src/lib/sdcaBacktest.ts` (shared Bun/TS modules).

**Rationale**: The SDCA engine is pure TypeScript logic used by both the Hono backend gateway (`POST /api/v1/sdca/backtest`) and client-side helpers. Keeping the implementation in a single shared file guarantees 1-to-1 metrics parity between client and server.

**Alternatives considered**:
- *Python subprocess execution*: Rejected — adds unnecessary IPC overhead and latency to interactive frontend recalculation requests.

### Decision 2: Hysteresis Transition Rules

**Choice**: Use explicit state tracking across daily records with strict $t-1$ causal boundaries:
```
- State OUT_ALL  -> DCA_IN   when valuation_composite[t-1] >= dca_in_start (default: +1.80)
- State DCA_IN   -> ALL_IN   when valuation_composite[t-1] <= all_in_val   (default: +1.50)
- State ALL_IN   -> DCA_OUT  when valuation_composite[t-1] <= dca_out_start (default: -1.50)
- State DCA_OUT  -> OUT_ALL  when valuation_composite[t-1] >= all_out_val  (default: 0.00)
```

**Rationale**: Hysteresis prevents rapid whipsawing / flickering near boundary thresholds while allowing full capital allocation during regime transitions.

### Decision 3: Frontend Parameter Form & Reactive API Dispatch

**Choice**: Place parameter controls inside an expandable "Strategy Configuration" drawer within `SdcaPanel.tsx`. On "Save & Recalculate", invoke `quantClient.getSdcaBacktest({ thresholds })`, update React state, and re-render `SdcaChart` and trade ledger.

**Rationale**: Keeps the UI clean and unobtrusive while allowing quantitative traders to perform instant scenario analysis.

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| User inputs contradictory thresholds (e.g. `all_in_val > dca_in_start`) | Add client-side validation rules in `validateThresholds()` and disable save button when invalid. |
| Frequent recalculation requests overload backend API | `computeSdcaBacktest()` operates in memory (< 5ms per run on Bun runtime). Add debouncing to range sliders. |
| Lookahead bias in state transitions | Enforce `comp_t1 = composites[i - 1]` strictly in `computeSdcaSignals()`. |

## Migration Plan

1. Update `src/lib/sdcaEngine.ts` interface and state transition logic.
2. Update `src/lib/sdcaBacktest.ts` backtest calculator.
3. Extend `src/api/routes/sdca.ts` `POST /api/v1/sdca/backtest` endpoint.
4. Update `web/src/components/studios/SdcaPanel.tsx` UI controls and state management.
5. Run full test suite and verify metric calculations.
