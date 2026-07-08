# Unified API Gateway Routes

## Purpose
Defines requirements for a single unified Hono v4 + Bun API Gateway endpoint architecture, consolidated daily analytics querying, and quantitative circuit breaker status broadcasting.

## Requirements

### Requirement: Single Hono v4 + Bun API Gateway Endpoint Architecture
All quantitative backend services and cross-system data feeds SHALL be exposed exclusively via a single unified Hono v4 + Bun API Gateway running on port `:8765` (`api.quant.maftia.tech`).

#### Scenario: Port and gateway consolidation check
- **WHEN** any frontend studio (`Valuation Studio`, `LTTD Lab`, `MTTD Console`, `Ichimoku Terminal`) or external client requests quantitative analytics
- **THEN** it MUST query endpoints under `api.quant.maftia.tech:8765` without spinning up or calling ad-hoc temporary backend servers on random ports (`:3000`, `:8766`, etc.)

### Requirement: Unified Daily Analytics and Component Signals Endpoints
The API Gateway SHALL provide standardized REST routes (`/api/v1/analytics/daily` and `/api/v1/analytics/components`) querying `UnifiedDailyAnalytics` (`unified_daily_analytics`) and `UnifiedComponentSignals` (`unified_component_signals`) inside `/home/ubuntu/projects/quant.maftia.tech/data/maftia_quant.db` strictly via `?-style` parameterized SQL queries with SQLite WAL concurrency (`PRAGMA journal_mode=WAL; PRAGMA query_only=true;`). The routes SHALL enforce strict $t-1$ `CausalFilter` date bounds ($date \le \text{today}$) to prevent lookahead bias.

#### Scenario: Consolidated multi-system query with causal verification
- **WHEN** a GET request is sent to `/api/v1/analytics/daily?start_date=2024-01-01`
- **THEN** the gateway MUST execute a `?-style` parameterized query against `maftia_quant.db` in read-only WAL mode, filter timestamps where $date \le \text{today}$, and return a consolidated JSON payload joining daily dates to `MasterOHLCV` prices and outputs from `ValuationComposite`, `LTTDRegime`, `MTTDIntegratedOscillator`, and `IchimokuDenoisedOscillator`

#### Scenario: Granular component signals query across systems
- **WHEN** a GET request is sent to `/api/v1/analytics/components?system=VALUATION&date=2026-07-08`
- **THEN** the gateway MUST execute a `?-style` parameterized query against `unified_component_signals` and return all matching indicator rows (`component_name`, `raw_value`, `normalized_score`, `signal_direction`) without lock contention

### Requirement: Quantitative Circuit Breaker Status Route
The API Gateway SHALL expose real-time macro override flags derived from `ValuationComposite` (`score >= +1.50` for bubble risk, `<= -1.00` for discount) and `LTTDRegime` (`SIDEWAYS` probability $> 0.60$ forcing `0.0` mid-term exposure).

#### Scenario: Circuit breaker state broadcasting
- **WHEN** a strategy execution engine or terminal client queries `/api/v1/system/circuit-breakers`
- **THEN** the response MUST accurately reflect the active macro overrides (`bubble_warning`, `deep_discount_override`, or `sideways_zero_exposure_lock`) based on `run_report_pipeline.py` outputs

### Requirement: API Gateway Health and System Metadata Route
The API Gateway SHALL expose a standardized health check and system metadata route (`/api/v1/health`) confirming WAL database connection status, active system version, and latest available data timestamp across all 4 quantitative systems (`quant-btc-valuation-system`, `quant-btc-lttd-system`, `quant-btc-mttd-system`, `quant-lttd-ichimoku`).

#### Scenario: Gateway liveness and database reachability verification
- **WHEN** a client queries `/api/v1/health`
- **THEN** the response MUST return HTTP `200 OK` with JSON metadata confirming that `maftia_quant.db` is accessible and indicating the maximum date present in `UnifiedDailyAnalytics`
