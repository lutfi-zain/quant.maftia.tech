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
The API Gateway SHALL provide standardized REST routes (`/api/v1/analytics/daily`, `/api/v1/quant/daily`, and `/api/v1/analytics/components`) querying `UnifiedDailyAnalytics` (`unified_daily_analytics`) and `UnifiedComponentSignals` (`unified_component_signals`) inside `/home/ubuntu/projects/quant.maftia.tech/data/maftia_quant.db` strictly via `?-style` parameterized SQL queries with SQLite WAL concurrency (`PRAGMA journal_mode=WAL; PRAGMA query_only=true;`). The routes SHALL enforce strict $t-1$ `CausalFilter` date bounds ($date \le \text{today}$) to prevent lookahead bias. Furthermore, when returning daily analytics objects for `ichimoku_imo`, the API Gateway MUST include `entropy` (`ichi_entropy`), `er` (`ichi_er`), and `imo_std` (`ichi_imo_std`) alongside `oscillator`, `regime`, `position`, `s_tk`, `s_cloud`, `s_future`, `s_chikou`, `tenkan`, `kijun`, `senkou_a`, `senkou_b`, and `chikou`.

#### Scenario: Consolidated multi-system query with causal verification
- **WHEN** a GET request is sent to `/api/v1/analytics/daily?start_date=2024-01-01` or `/api/v1/quant/daily`
- **THEN** the gateway MUST execute a `?-style` parameterized query against `maftia_quant.db` in read-only WAL mode, filter timestamps where $date \le \text{today}$, and return a consolidated JSON payload joining daily dates to `MasterOHLCV` prices and outputs from `ValuationComposite`, `LTTDRegime`, `MTTDIntegratedOscillator`, and `IchimokuDenoisedOscillator` where `ichimoku_imo` contains `{ oscillator, regime, position, s_tk, s_cloud, s_future, s_chikou, tenkan, kijun, senkou_a, senkou_b, chikou, entropy, er, imo_std }`

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

### Requirement: Renormalize endpoint at POST /api/v1/quant/metric/:metric_name/renormalize
The unified Hono API gateway SHALL expose a `POST /api/v1/quant/metric/:metric_name/renormalize` route that triggers per-metric renormalization of `unified_component_signals.normalized_score` values.

See `valuation-studio-renormalize-flow/spec.md` for full endpoint contract.

#### Scenario: Renormalize route is registered in Hono router
- **WHEN** the Hono app initializes
- **THEN** `POST /api/v1/quant/metric/:metric_name/renormalize` is a registered route

### Requirement: Bulk defaults endpoint at GET /api/v1/quant/metrics/defaults
The unified Hono API gateway SHALL expose `GET /api/v1/quant/metrics/defaults` returning default threshold configs for all 17 `UnifiedComponentSignals` indicators from the `DEFAULT_THRESHOLDS` constant.

#### Scenario: Defaults endpoint returns all 17 indicators
- **WHEN** `GET /api/v1/quant/metrics/defaults` is called
- **THEN** the response body is a JSON object with 17 entries, one per indicator
- **AND** each entry contains `{ t_plus_2, t_plus_1, t_zero, t_minus_1, t_minus_2 }` threshold values

#### Scenario: Defaults endpoint is read-only and safe to call without side effects
- **WHEN** `GET /api/v1/quant/metrics/defaults` is called repeatedly
- **THEN** no database writes occur and the response is idempotent

### Requirement: mapToOscillator returns 0.0 for out-of-range inputs
The `mapToOscillator` function in `web/src/lib/oscillator.ts` SHALL return `0.0` (not `null`) when the input raw value falls outside all defined threshold ranges, ensuring downstream components always receive a numeric value.

#### Scenario: Out-of-range input returns 0.0 not null
- **WHEN** `mapToOscillator` is called with a raw value outside all threshold ranges
- **THEN** the return value is `0.0` (a valid number)
- **AND** the caller does not receive `null`

#### Scenario: In-range input returns correct oscillator value
- **WHEN** `mapToOscillator` is called with a raw value within a defined threshold range
- **THEN** the return value is in `[-2.0, +2.0]` matching the piecewise linear interpolation

