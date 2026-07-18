## Context

The SDCA implementation was flipped during the prior optimization work, and several runtime surfaces now disagree about what `valuation_composite` means. The existing SDCA specifications and the historical distribution/forward-return pattern point to one canonical convention, but the shared engine, backtest logic, and some UI labels were temporarily changed to the opposite interpretation.

This change is cross-cutting:

- `src/lib/sdcaEngine.ts` and `web/src/lib/sdcaEngine.ts` must agree on the same multiplier, phase, and action mapping.
- `src/lib/sdcaBacktest.ts`, `src/api/routes/sdca.ts`, and `web/src/lib/studioBacktest.ts` must remain consistent with the shared engine.
- SDCA-facing UI surfaces (`SdcaPanel`, `ValuationStudio`) must not contradict the engine or backtest behavior.
- The change must preserve strict t-1 causal filtering and not alter the underlying `valuation_composite` calculation from the Valuation system.

## Goals / Non-Goals

**Goals:**

- Restore one canonical SDCA convention end-to-end across engine, backend, backtest, and UI.
- Ensure negative composite values map to DCA-out / overvaluation and positive values map to DCA-in / undervaluation.
- Keep shared frontend/backend logic byte-identical where it is intentionally duplicated.
- Prevent future drift between runtime logic and displayed labels.
- Preserve all causal filtering and portfolio/accounting behavior.

**Non-Goals:**

- Do not change `valuation_composite` generation or any of the 4 core quant systems.
- Do not add new trading features, new thresholds, or adaptive sizing logic in this change.
- Do not reintroduce deprecated `quant-technical-indicator-bank` components.
- Do not change the single unified API gateway architecture or spin up alternate servers.
- Do not relax the t-1 causal filter.

## Decisions

1. **Keep the SDCA engine as the canonical source of truth.**
   - `src/lib/sdcaEngine.ts` should define the single convention used by the backend and frontend copies.
   - Alternative: keep separate frontend logic and backend logic. Rejected because it increases drift risk and is what created the mismatch.

2. **Mirror the canonical engine into the frontend shared module.**
   - `web/src/lib/sdcaEngine.ts` should remain identical to the backend copy.
   - Alternative: import the backend module directly from the frontend. Rejected because the current repo layout already treats them as paired shared code and the runtime/build setup expects the frontend path.

3. **Make backtest and API routes consume resolved thresholds from the shared engine.**
   - `sdcaBacktest.ts` and `sdca.ts` should rely on the shared threshold semantics rather than re-encoding sign assumptions locally.
   - Alternative: duplicate threshold math in each caller. Rejected because it is error-prone and complicates validation.

4. **Drive visible labels from the canonical convention rather than hardcoded copy.**
   - `SdcaPanel` and `ValuationStudio` should render threshold/badge copy that matches the engine semantics.
   - Alternative: leave labels as static text. Rejected because it allows the UI to drift from the engine again.

5. **Preserve causal execution exactly as-is.**
   - The change must not alter the t-1 boundary in signal generation, backtesting, or percentile/trend calculations.
   - Alternative: revisit lookback windows during this fix. Rejected because the issue is convention drift, not temporal leakage.

## Risks / Trade-offs

- **Runtime/UI drift returns if one copy is updated without the other** → Mitigation: keep backend/frontend shared modules identical and verify with diff/tests.
- **Users may see a sudden sign reversal in charts or signals** → Mitigation: update banner copy and threshold labels together so the direction is explicit.
- **Backtests may produce materially different results after the restore** → Mitigation: re-run the verification script and compare sample dates before archiving.
- **Documentation may lag behind implementation** → Mitigation: keep the spec delta minimal and focused on convention consistency.
- **Surface area spans multiple modules** → Mitigation: implement in this order: engine → shared frontend copy → backend/backtest → UI labels → verification.
