# sdca-recalculate-api Specification

## Purpose

Provide a backend API endpoint that accepts custom SDCA thresholds, runs the full SDCA engine (signal computation + backtest), and returns updated results.

## Requirements

### Requirement: Threshold Recalculation Endpoint

The system SHALL expose a `POST /api/v1/sdca/recalculate` endpoint that accepts custom threshold values and returns recomputed SDCA backtest results.

#### Scenario: Successful recalculation with custom thresholds

- **WHEN** a `POST` request is sent to `/api/v1/sdca/recalculate` with a valid `thresholds` object in the request body
- **THEN** the system SHALL merge the provided thresholds with defaults via `mergeThresholds()`
- **AND** SHALL run `computeSdcaSignals()` followed by `computeSdcaBacktest()` with the merged thresholds
- **AND** SHALL return the full result including `metrics`, `equity_curve`, `trade_log`, and `signals`

#### Scenario: Partial threshold overrides

- **WHEN** the request body contains only a subset of threshold fields (e.g., only `dca_in_start`)
- **THEN** the system SHALL use the provided values and fall back to `DEFAULT_SDCA_THRESHOLDS` for missing fields

### Requirement: Validation

The endpoint SHALL validate all threshold values using the existing `validateThresholds()` function before computing.

#### Scenario: Invalid thresholds

- **WHEN** any threshold value falls outside its allowed range
- **THEN** the system SHALL clamp the value to the valid range
- **AND** proceed with the clamped value (no error — soft clamp)
