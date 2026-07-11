## ADDED Requirements

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
