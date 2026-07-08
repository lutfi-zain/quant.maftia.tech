## ADDED Requirements

### Requirement: Single Hono v4 + Bun API Gateway Endpoint Architecture
All quantitative backend services and cross-system data feeds SHALL be exposed exclusively via a single unified Hono v4 + Bun API Gateway running on port `:8765` (`api.quant.maftia.tech`).

#### Scenario: Port and gateway consolidation check
- **WHEN** any frontend studio (`Valuation Studio`, `LTTD Lab`, `MTTD Console`, `Ichimoku Terminal`) or external client requests quantitative analytics
- **THEN** it MUST query endpoints under `api.quant.maftia.tech:8765` without spinning up or calling ad-hoc temporary backend servers on random ports (`:3000`, `:8766`, etc.)

### Requirement: Unified Daily Analytics and Component Signals Endpoints
The API Gateway SHALL provide standardized REST and WebSocket routes querying `UnifiedDailyAnalytics` (`unified_daily_analytics`) and `UnifiedComponentSignals` (`unified_component_signals`) using parameterized SQL queries with SQLite WAL concurrency.

#### Scenario: Consolidated multi-system query
- **WHEN** a GET request is sent to `/api/v1/analytics/daily?start_date=2024-01-01`
- **THEN** the gateway MUST return a consolidated JSON payload joining daily dates to `MasterOHLCV` prices and outputs from `ValuationComposite`, `LTTDRegime`, `MTTDIntegratedOscillator`, and `IchimokuDenoisedOscillator`

### Requirement: Quantitative Circuit Breaker Status Route
The API Gateway SHALL expose real-time macro override flags derived from `ValuationComposite` (`score >= +1.50` for bubble risk, `<= -1.00` for discount) and `LTTDRegime` (`SIDEWAYS` probability $> 0.60$ forcing `0.0` mid-term exposure).

#### Scenario: Circuit breaker state broadcasting
- **WHEN** a strategy execution engine or terminal client queries `/api/v1/system/circuit-breakers`
- **THEN** the response MUST accurately reflect the active macro overrides (`bubble_warning`, `deep_discount_override`, or `sideways_zero_exposure_lock`) based on `run_report_pipeline.py` outputs
