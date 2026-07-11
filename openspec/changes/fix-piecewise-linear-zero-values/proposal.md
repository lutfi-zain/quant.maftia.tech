## Why

Across the frontend terminal studios (`Valuation Studio`, `LTTD Lab`, `MTTD Console`, and `Ichimoku Terminal`), the individual component breakdown matrices (`Piecewise Linear Component Matrix` showing all 17 fundamental, technical, and sentiment indicators) currently display `0.00` / `0.000` / `0` across all rows. 

This issue stems from a query identifier disconnect between the frontend API client and the API Gateway route handler (`src/api/routes/components.ts`). When studio components invoke `quantClient.getComponents("quant-btc-valuation-system")`, the `componentsRouter` route handler converts the `system` query parameter directly using `systemSource.toUpperCase()`, resulting in SQL query parameters such as `QUANT-BTC-VALUATION-SYSTEM`. However, the canonical SQLite `unified_component_signals` table (`data/maftia_quant.db`) stores `system_source` using clean, domain-driven ubiquitous language strings (`VALUATION`, `LTTD`, `MTTD`, and `ICHIMOKU`). Consequently, `SELECT` queries against `unified_component_signals` return zero rows (`[]`), causing the frontend tables to fall back to `0.00` for every indicator.

## What Changes

- Normalize system identifier mapping inside `src/api/routes/components.ts` (`componentsRouter`) so that incoming query strings (`quant-btc-valuation-system`, `VALUATION`, `quant-btc-lttd-system`, `LTTD`, `quant-btc-mttd-system`, `MTTD`, `quant-lttd-ichimoku`, `ICHIMOKU`) are deterministically mapped to the exact canonical database values (`VALUATION`, `LTTD`, `MTTD`, `ICHIMOKU`) before executing parameterized queries.
- Ensure `web/src/api/client.ts` consistently invokes `getComponents()` with clean system identifiers while strictly enforcing causal data filtering ($t-1$ boundary verification).
- Verify that all 4 studio components (`ValuationStudio.tsx`, `LttdLab.tsx`, `MttdConsole.tsx`, `IchimokuTerminal.tsx`) successfully render historical and current component values without zero fallbacks.

## Capabilities

### New Capabilities
- `system-source-mapping`: Canonical query parameter normalization and causal verification across the Hono API Gateway (`src/api/routes/components.ts`) and frontend API client (`web/src/api/client.ts`) ensuring exact alignment with the `unified_component_signals` database schema.

### Modified Capabilities

## Impact

- **Affected Systems**: All 4 unified quantitative systems (`quant-btc-valuation-system`, `quant-btc-lttd-system`, `quant-btc-mttd-system`, `quant-lttd-ichimoku`).
- **Affected Code**: `src/api/routes/components.ts` (API Gateway route handler), `web/src/api/client.ts` (frontend REST client).
- **Security & Compliance**: Maintains strict zero lookahead bias (`CausalFilter`) with $t-1$ timestamp checks and preserves SQLite WAL read-only concurrency against `data/maftia_quant.db`.

## Non-goals

- Modifying existing quantitative calculations or mathematical formulas across the Python analysis pipelines (`01_quant_btc_valuation_system`, `02_quant_btc_lttd_system`, `03_quant_btc_mttd_system`, `04_quant_lttd_ichimoku`).
- Re-introducing or referencing the deprecated `quant-technical-indicator-bank` project (`05. Indicator Bank`).
