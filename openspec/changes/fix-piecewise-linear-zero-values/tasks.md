## 1. API Gateway System Source Normalization

- [x] 1.1 Implement `normalizeSystemSource(rawInput?: string): string | null` helper inside `src/api/routes/components.ts` mapping incoming query strings (`quant-btc-valuation-system`, `valuation`, `quant-btc-lttd-system`, `lttd`, `quant-btc-mttd-system`, `mttd`, `quant-lttd-ichimoku`, `ichimoku`) to exact upper-case database identifiers (`VALUATION`, `LTTD`, `MTTD`, `ICHIMOKU`).
- [x] 1.2 Update the SQL `WHERE` clause generator in `src/api/routes/components.ts` to use normalized `system_source` and verify that queries to `/api/v1/quant/components?system=quant-btc-valuation-system` return non-empty rows with exact `normalized_score` values.

## 2. Frontend Client & Studio Verification

- [x] 2.1 Audit `web/src/api/client.ts` (`getComponents` and `getMetricTimeseries`) ensuring causal filtering verification ($t-1$ boundary checking) operates correctly on normalized component signals.
- [x] 2.2 Verify `ValuationStudio.tsx` (`Piecewise Linear Component Matrix`), `LttdLab.tsx`, `MttdConsole.tsx`, and `IchimokuTerminal.tsx` to confirm that all 17 fundamental, technical, and sentiment indicator rows render live scores and direction indicators (`-1`, `0`, `+1`) without showing `0.00` fallbacks.

## 3. Final Verification & Clean Commit

- [x] 3.1 Run TypeScript compiler (`cd web && bun run tsc --noEmit`) to verify zero type errors across API and frontend studio components.
- [x] 3.2 Run `python3 /home/ubuntu/projects/run_report_pipeline.py` to confirm overall quantitative data integrity across the 4-system pipeline.
- [x] 3.3 Commit all changes adhering to Conventional Commits specification (`fix(api): normalize system source queries to resolve zero-value fallbacks in studio component matrices`) and push clean changes to repository.
