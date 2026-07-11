# system-source-mapping Specification

## Purpose
TBD - created by archiving change fix-piecewise-linear-zero-values. Update Purpose after archive.

## Requirements

### Requirement: API Gateway System Source Normalization
The API Gateway route handler (`src/api/routes/components.ts`) SHALL normalize incoming `system` or `system_source` query parameter strings (`quant-btc-valuation-system`, `quant-btc-lttd-system`, `quant-btc-mttd-system`, `quant-ltd-ichimoku`, or their short domain names) into exact upper-case canonical database identifiers (`VALUATION`, `LTTD`, `MTTD`, `ICHIMOKU`) before querying the `unified_component_signals` table.

#### Scenario: Normalizing valuation system identifier
- **WHEN** a client sends a GET request to `/api/v1/quant/components?system=quant-btc-valuation-system`
- **THEN** the API Gateway translates the query parameter to `VALUATION` and executes a parameterized SQL query matching `system_source = 'VALUATION'` against `data/maftia_quant.db`

#### Scenario: Normalizing lttd system identifier
- **WHEN** a client sends a GET request to `/api/v1/quant/components?system=quant-btc-lttd-system`
- **THEN** the API Gateway translates the query parameter to `LTTD` and retrieves component signals where `system_source = 'LTTD'`

#### Scenario: Normalizing mttd system identifier
- **WHEN** a client sends a GET request to `/api/v1/quant/components?system=quant-btc-mttd-system`
- **THEN** the API Gateway translates the query parameter to `MTTD` and retrieves component signals where `system_source = 'MTTD'`

#### Scenario: Normalizing ichimoku system identifier
- **WHEN** a client sends a GET request to `/api/v1/quant/components?system=quant-ltd-ichimoku`
- **THEN** the API Gateway translates the query parameter to `ICHIMOKU` and retrieves component signals where `system_source = 'ICHIMOKU'`

### Requirement: Frontend Studio Component Hydration Without Zero Fallback
The frontend API client (`web/src/api/client.ts`) and studio components (`ValuationStudio.tsx`, `LttdLab.tsx`, `MttdConsole.tsx`, `IchimokuTerminal.tsx`) SHALL query and display historical component signals from `UnifiedComponentSignals` without defaulting to zero (`0.00` / `0`) when valid historical rows exist in `maftia_quant.db`.

#### Scenario: Rendering Piecewise Linear Component Matrix in Valuation Studio
- **WHEN** `ValuationStudio.tsx` mounts and loads component data via `quantClient.getComponents("quant-btc-valuation-system")`
- **THEN** all 17 piecewise linear indicators populate with their exact normalized scores `[-2.0, +2.0]` and signal directions (`-1`, `0`, `+1`) without showing `0.00` across all rows

### Requirement: Causal Verification on Normalized Component Queries
All component signal retrieval operations across `client.ts` and `componentsRouter` SHALL enforce strict causal filtering ($t-1$ boundary checking against `today`) to prevent lookahead bias.

#### Scenario: Querying future date component signals
- **WHEN** a request is made with a `date` parameter exceeding the current calendar date
- **THEN** the API Gateway blocks future rows via causal filtering (`1 = 0` condition) and returns zero lookahead records while indicating `causal_filter.applied = true`
