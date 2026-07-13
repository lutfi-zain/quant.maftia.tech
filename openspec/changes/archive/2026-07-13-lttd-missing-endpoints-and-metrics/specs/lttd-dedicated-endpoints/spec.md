## ADDED Requirements

### Requirement: Backend shall provide /api/v1/lttd/latest endpoint

The system SHALL expose a `GET /api/v1/lttd/latest` endpoint returning the most recent LTTD evaluation record from `unified_daily_analytics` with full price data, regime classification, score, and component details.

#### Scenario: Returns latest LTTD record

- **WHEN** client sends `GET /api/v1/lttd/latest`
- **THEN** response status is `200` and body contains `date`, `open`, `high`, `low`, `close`, `volume`, `lttd_regime`, `lttd_score`, `lttd_prob_bull`, `lttd_prob_bear`, `lttd_prob_sideways`

#### Scenario: No data in database

- **WHEN** `unified_daily_analytics` is empty
- **THEN** response status is `404` with body containing error message

#### Scenario: CausalFilter enforces t-1

- **WHEN** the current date's record exists but is incomplete (future date)
- **THEN** the endpoint SHALL only return the most recent complete record with date <= today

### Requirement: Backend shall provide /api/v1/lttd/history endpoint

The system SHALL expose a `GET /api/v1/lttd/history` endpoint returning historical LTTD evaluation records within an optional date range (`start`, `end` query parameters). Defaults to last 500 records when no dates provided.

#### Scenario: Returns history with date filter

- **WHEN** client sends `GET /api/v1/lttd/history?start=2025-01-01&end=2025-06-01`
- **THEN** response status is `200` and body contains an array of daily records within the date range

#### Scenario: Returns history without date filter

- **WHEN** client sends `GET /api/v1/lttd/history`
- **THEN** response status is `200` and body contains the last 500 records sorted by date descending

#### Scenario: Invalid date format returns error

- **WHEN** client sends `GET /api/v1/lttd/history?start=invalid`
- **THEN** response status is `400` with error message indicating invalid date format

### Requirement: Backend shall provide /api/v1/lttd/chart endpoint

The system SHALL expose a `GET /api/v1/lttd/chart` endpoint returning daily price action (open, high, low, close, volume) along with lttd_score and target_exposure for charting.

#### Scenario: Returns chart data

- **WHEN** client sends `GET /api/v1/lttd/chart`
- **THEN** response body contains an array with each entry having `date`, `open`, `high`, `low`, `close`, `volume`, `lttd_score`, `target_exposure`

### Requirement: Backend shall provide /api/v1/lttd/regime endpoint

The system SHALL expose a `GET /api/v1/lttd/regime` endpoint returning daily regime probabilities (p_bull, p_bear, p_sideways summing to 1.0) derived from posterior probability data in `unified_daily_analytics`.

#### Scenario: Returns regime probabilities

- **WHEN** client sends `GET /api/v1/lttd/regime`
- **THEN** response body contains an array with each entry having `date`, `regime`, `p_bull`, `p_bear`, `p_sideways` where the three probabilities sum to approximately 1.0

#### Scenario: Probabilities derived from posterior data

- **WHEN** `lttd_prob_bull`, `lttd_prob_bear`, `lttd_prob_sideways` are present in the DB row
- **THEN** the endpoint returns these exact values (no synthetic distribution)

#### Scenario: Missing probability data uses synthetic distribution

- **WHEN** the row has only `lttd_regime` without individual probabilities
- **THEN** the regime with `regime` value gets the `posterior_prob` (or 0.85 as default) with remaining probability split equally among the other two regimes

### Requirement: Backend shall provide /api/v1/lttd/diagnostics endpoint

The system SHALL expose a `GET /api/v1/lttd/diagnostics` endpoint returning indicator scores, PCA component loadings, VIF statistics, and PCA variance explained for visual diagnostics.

#### Scenario: Returns diagnostics data

- **WHEN** client sends `GET /api/v1/lttd/diagnostics`
- **THEN** response body contains an array with each entry having `date`, `indicator_scores` (object), `pca_components` (object without VIF_ prefix keys), `vif` (object), `pca_variance_explained` (number)

#### Scenario: VIF keys separated from PCA components

- **WHEN** the DB row has `pca_components` containing keys prefixed with `VIF_`
- **THEN** the response separates them: `VIF_*` keys go to `vif` object, non-VIF keys go to `pca_components`, and `pca_variance_explained` is extracted as a top-level field

### Requirement: Backend shall provide /api/v1/lttd/onchain endpoint

The system SHALL expose a `GET /api/v1/lttd/onchain` endpoint returning on-chain metrics (STH-MVRV, STH-NUPL, STH-SOPR) from `unified_component_signals` for LTTD system, with optional date range filtering.

#### Scenario: Returns on-chain data

- **WHEN** client sends `GET /api/v1/lttd/onchain`
- **THEN** response body contains an array with each entry having `date`, `sth_mvrv` (nullable number), `sth_nupl` (nullable number), `sth_sopr_24h` (nullable number)

#### Scenario: Filters by date range

- **WHEN** client sends `GET /api/v1/lttd/onchain?start=2025-01-01&end=2025-06-01`
- **THEN** only entries within the date range are returned

#### Scenario: Falls back to valuation on-chain data

- **WHEN** no LTTD on-chain component signals exist in the database
- **THEN** the response SHALL fall back to valuation system on-chain signals with a `x-data-source: valuation-fallback` response header

### Requirement: Backend shall provide /api/v1/lttd/actions/run endpoint

The system SHALL expose a `POST /api/v1/lttd/actions/run` endpoint that spawns the corresponding Python pipeline script and returns execution results. Supported actions: `sync_today`, `recover_10d`, `sync_gap`, `full_repopulation`, `vif_audit`, `reset_db`.

#### Scenario: Runs sync_today action

- **WHEN** client sends `POST /api/v1/lttd/actions/run` with body `{"action": "sync_today"}`
- **THEN** backend spawns `python3 run_pipeline.py` in `/home/ubuntu/projects/quant-btc-lttd-system/` and returns `{"success": true, "output": "..."}`

#### Scenario: Unknown action returns error

- **WHEN** client sends `POST /api/v1/lttd/actions/run` with body `{"action": "unknown_xyz"}`
- **THEN** response status is `400` with `{"error": "Unknown action"}`

#### Scenario: Missing action field returns error

- **WHEN** client sends `POST /api/v1/lttd/actions/run` with empty body
- **THEN** response status is `400` with `{"error": "No action provided"}`
