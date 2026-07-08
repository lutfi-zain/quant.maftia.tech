## MODIFIED Requirements

### Requirement: Unified Daily Analytics and Component Signals Endpoints
The API Gateway SHALL provide standardized REST routes (`/api/v1/analytics/daily` and `/api/v1/analytics/components`) querying `UnifiedDailyAnalytics` (`unified_daily_analytics`) and `UnifiedComponentSignals` (`unified_component_signals`) inside `/home/ubuntu/projects/quant.maftia.tech/data/maftia_quant.db` strictly via `?-style` parameterized SQL queries with SQLite WAL concurrency (`PRAGMA journal_mode=WAL; PRAGMA query_only=true;`). The routes SHALL enforce strict $t-1$ `CausalFilter` date bounds ($date \le \text{today}$) to prevent lookahead bias.

#### Scenario: Consolidated multi-system query with causal verification
- **WHEN** a GET request is sent to `/api/v1/analytics/daily?start_date=2024-01-01`
- **THEN** the gateway MUST execute a `?-style` parameterized query against `maftia_quant.db` in read-only WAL mode, filter timestamps where $date \le \text{today}$, and return a consolidated JSON payload joining daily dates to `MasterOHLCV` prices and outputs from `ValuationComposite`, `LTTDRegime`, `MTTDIntegratedOscillator`, and `IchimokuDenoisedOscillator`

#### Scenario: Granular component signals query across systems
- **WHEN** a GET request is sent to `/api/v1/analytics/components?system=VALUATION&date=2026-07-08`
- **THEN** the gateway MUST execute a `?-style` parameterized query against `unified_component_signals` and return all matching indicator rows (`component_name`, `raw_value`, `normalized_score`, `signal_direction`) without lock contention

## ADDED Requirements

### Requirement: API Gateway Health and System Metadata Route
The API Gateway SHALL expose a standardized health check and system metadata route (`/api/v1/health`) confirming WAL database connection status, active system version, and latest available data timestamp across all 4 quantitative systems (`quant-btc-valuation-system`, `quant-btc-lttd-system`, `quant-btc-mttd-system`, `quant-lttd-ichimoku`).

#### Scenario: Gateway liveness and database reachability verification
- **WHEN** a client queries `/api/v1/health`
- **THEN** the response MUST return HTTP `200 OK` with JSON metadata confirming that `maftia_quant.db` is accessible and indicating the maximum date present in `UnifiedDailyAnalytics`
