## Context

In the `maftia_quant.db` SQLite database (specifically under `data/maftia_quant.db`), the `unified_component_signals` table tracks granular time-series data for individual component indicators across the 4 quantitative systems. The `system_source` column in this table stores exact upper-case domain values: `'VALUATION'`, `'LTTD'`, `'MTTD'`, and `'ICHIMOKU'`. 

However, when the frontend SPA (`web/src/api/client.ts`) queries the API Gateway (`:8765`), studio components pass system names such as `"quant-btc-valuation-system"`, `"quant-btc-lttd-system"`, `"quant-btc-mttd-system"`, or `"quant-lttd-ichimoku"`. In `src/api/routes/components.ts`, the `componentsRouter` directly converts incoming `system` query strings using `.toUpperCase()`, generating SQL query conditions like `WHERE system_source = 'QUANT-BTC-VALUATION-SYSTEM'`. Because no records match these strings, the SQLite query returns zero rows (`[]`). 

As a result, all 4 studio breakdown tables—including the 17-indicator Piecewise Linear Component Matrix on `ValuationStudio.tsx`, the HMM/Volatility table on `LttdLab.tsx`, the 10-family consensus table on `MttdConsole.tsx`, and the SuperSmoother component table on `IchimokuTerminal.tsx`—default every indicator score and signal direction to `0.00` / `0`.

## Goals / Non-Goals

**Goals:**
- Implement a robust `normalizeSystemSource()` mapping helper inside `src/api/routes/components.ts` (`componentsRouter`) that converts `quant-btc-valuation-system` and related variations into canonical DB identifiers (`VALUATION`, `LTTD`, `MTTD`, `ICHIMOKU`).
- Ensure `web/src/api/client.ts` cleanly handles `getComponents()` calls across all 4 studios without breaking causal filtering ($t-1$ cutoff verification).
- Guarantee that `ValuationStudio.tsx` renders all 17 Piecewise Linear Component Matrix indicator scores accurately (in `[-2.0, +2.0]` range) with exact sparklines and overbought/discount classification badges.

**Non-Goals:**
- Altering the SQLite database schema (`unified_component_signals`) or modifying historical ingested records in `data/maftia_quant.db`.
- Modifying underlying quant computation logic in `01_quant_btc_valuation_system` or any other subsystem script.
- Touching deprecated modules like `quant-technical-indicator-bank`.

## Decisions

### Decision 1: Server-Side Query Normalization in `componentsRouter`
- **Choice**: Add a `normalizeSystemSource(rawInput?: string): string | null` function directly in `src/api/routes/components.ts` before constructing the SQL `WHERE` conditions.
- **Rationale**: By normalizing on the server inside `componentsRouter`, the API Gateway (`:8765`) becomes resilient to both full system names (`quant-btc-valuation-system`) and short names (`VALUATION` or `valuation`) passed by any client or third-party consumer.
- **Alternatives Considered**: Only changing `client.ts` on the frontend to pass `"VALUATION"` instead of `"quant-btc-valuation-system"`. This was rejected because existing API contract documentation and potential other clients/scripts already invoke `/api/v1/quant/components?system=quant-btc-valuation-system`. Server-side normalization ensures backward and forward compatibility while keeping frontend queries readable.

### Decision 2: Exact System-to-Domain Mapping Table
- **Mapping Rules**:
  - `quant-btc-valuation-system` | `valuation` | `VALUATION` $\rightarrow$ `'VALUATION'`
  - `quant-btc-lttd-system` | `lttd` | `LTTD` $\rightarrow$ `'LTTD'`
  - `quant-btc-mttd-system` | `mttd` | `MTTD` $\rightarrow$ `'MTTD'`
  - `quant-lttd-ichimoku` | `ichimoku` | `ICHIMOKU` $\rightarrow$ `'ICHIMOKU'`

## Risks / Trade-offs

- **[Risk: Component Name Case-Sensitivity or Key Mismatch]** $\rightarrow$ **Mitigation**: Verify that indicator keys returned in the API (`component_name`) precisely match the frontend metadata dictionary (`INDICATOR_METADATA` in `ValuationStudio.tsx`, and component mappings in `LttdLab.tsx`, `MttdConsole.tsx`, `IchimokuTerminal.tsx`).
- **[Risk: High Payload Volume when Fetching All Components]** $\rightarrow$ **Mitigation**: Ensure `componentsRouter` maintains a default/maximum `limit` (e.g., `5000` rows) so that fetching 90 days of sparkline history across 17 indicators ($\approx 1,530$ rows) completes rapidly under `bun:sqlite` WAL concurrency without payload truncation.

## Migration Plan

1. Update `src/api/routes/components.ts` with `normalizeSystemSource()`.
2. Verify API response locally via `curl -s "http://localhost:8765/api/v1/quant/components?system=quant-btc-valuation-system&limit=5"`.
3. Verify that the frontend SPA correctly hydrates all indicator rows across `ValuationStudio.tsx`, `LttdLab.tsx`, `MttdConsole.tsx`, and `IchimokuTerminal.tsx`.
